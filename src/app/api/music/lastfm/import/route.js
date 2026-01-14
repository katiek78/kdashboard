import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeString } from "@/lib/musicImportUtils";
import { parseDateToISO } from "@/lib/dateUtils";

export async function POST(req) {
  try {
    const body = await req.json();
    // Accept either a provided tracks array (from preview page) OR a username+from+to to fetch all pages server-side
    let tracks = Array.isArray(body.tracks) ? body.tracks : [];
    const username = body.username || null;
    const from = body.from || null;
    const to = body.to || null;

    if ((!tracks || tracks.length === 0) && !username) {
      return NextResponse.json(
        { error: "No tracks provided and no username given" },
        { status: 400 }
      );
    }

    const LASTFM_KEY =
      process.env.LASTFM_API_KEY || process.env.NEXT_PUBLIC_LASTFM_KEY;
    const ua = process.env.NEXT_PUBLIC_APP_NAME
      ? `${process.env.NEXT_PUBLIC_APP_NAME} lastfm-import`
      : "kdashboard lastfm-import";

    // If username provided and no tracks supplied, fetch all pages from Last.fm for the date range
    if ((!tracks || tracks.length === 0) && username) {
      if (!LASTFM_KEY)
        return NextResponse.json(
          { error: "Missing Last.fm API key on server" },
          { status: 500 }
        );
      const limit = 200; // fetch max per page
      let page = 1;
      let totalPages = 1;
      const fetched = [];
      const maxPages = 200; // safety cap
      while (page <= totalPages && page <= maxPages) {
        const url = new URL("https://ws.audioscrobbler.com/2.0/");
        url.searchParams.set("method", "user.getrecenttracks");
        url.searchParams.set("user", username);
        url.searchParams.set("api_key", LASTFM_KEY);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("page", String(page));
        if (from) url.searchParams.set("from", String(from));
        if (to) url.searchParams.set("to", String(to));

        const r = await fetch(url.toString(), {
          headers: { "User-Agent": ua },
        });
        if (!r.ok) {
          const txt = await r.text();
          return NextResponse.json(
            { error: `Last.fm fetch failed page ${page}: ${r.status} ${txt}` },
            { status: 502 }
          );
        }
        const payload = await r.json();
        const raw = payload?.recenttracks?.track || [];
        const attr = payload?.recenttracks?.["@attr"] || {};
        totalPages = Number(attr.totalPages || 1);

        for (const t of raw) {
          const title = t.name || "";
          const artist =
            (t.artist && (t.artist["#text"] || t.artist.name)) || "";
          const dateObj = t.date || null;
          const unix = dateObj && dateObj.uts ? Number(dateObj.uts) : null;
          const iso = unix
            ? new Date(unix * 1000).toISOString().split("T")[0]
            : null;
          if (!iso) continue; // skip undated
          fetched.push({ title, artist, isoDate: iso });
        }

        page += 1;
        // small delay to be nice to Last.fm (and avoid bursts) - optional
        await new Promise((res) => setTimeout(res, 150));
      }

      // sort oldest -> newest
      fetched.sort((a, b) =>
        a.isoDate < b.isoDate ? -1 : a.isoDate > b.isoDate ? 1 : 0
      );
      tracks = fetched;
    }

    // require auth token so RLS will scope operations to this user
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Filter & normalize tracks: only dated tracks (isoDate required)
    const good = tracks
      .map((t) => ({
        title: t.title || "",
        artist: t.artist || "",
        iso: t.isoDate || t.iso || null,
        normTitle: normalizeString(t.title || ""),
        normArtist: normalizeString(t.artist || ""),
      }))
      .filter((t) => t.iso);

    // sort oldest -> newest by iso (YYYY-MM-DD naturally sorts)
    good.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));

    const dryRun = !!body.dryRun;

    // If dryRun is requested, simulate the import and return a plan summary without writing to DB
    if (dryRun) {
      // require auth token so we can check for existing songs under the user's RLS
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token)
        return NextResponse.json(
          { error: "Authentication required for dryRun" },
          { status: 401 }
        );

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const uniqueCount = new Set(good.map(g => `${g.normTitle}|||${g.normArtist}`)).size;
      const plan = {
        totalFetched: tracks.length,
        datedCount: good.length,
        uniqueCount,
        wouldCreate: 0,
        wouldUpdate: 0,
        wouldLink: 0,
        skipped: 0,
      };

      // Pre-populate existing songs map for lookups (keyed by normTitle|||normArtist)
      const existing = {};
      for (const g of good) {
        const key = `${g.normTitle}|||${g.normArtist}`;
        if (existing[key]) continue;
        try {
          const { data: exact } = await db
            .from("songs")
            .select("id,first_listen_date")
            .eq("norm_title", g.normTitle)
            .eq("norm_artist", g.normArtist)
            .limit(1)
            .maybeSingle();
          if (exact) existing[key] = exact;
        } catch (e) {
          console.error("Dry-run lookup error", e);
        }
      }

      // Simulate sequential processing so duplicates in the fetched list are handled like real import
      const seen = { ...existing };
      for (const g of good) {
        const parsed = parseDateToISO(g.iso);
        if (!parsed) {
          plan.skipped++;
          continue;
        }
        const key = `${g.normTitle}|||${g.normArtist}`;
        const prior = seen[key];
        if (prior) {
          // Would update the existing song if parsed is earlier; otherwise it would be linked
          const priorDate = prior.first_listen_date || null;
          if (!priorDate || parsed < priorDate) {
            plan.wouldUpdate++;
            // simulate the earlier date becoming the song's first_listen_date
            seen[key] = { ...prior, first_listen_date: parsed };
          } else {
            plan.wouldLink++;
          }
        } else {
          plan.wouldCreate++;
          // simulate creation
          seen[key] = { created: true, first_listen_date: parsed };
        }
      }

      return NextResponse.json({ success: true, dryRun: true, plan, sample: good.slice(0, 15) });
    }

    const results = { created: [], updated: [], linked: [], skipped: 0 };

    for (const t of good) {
      const parsed = parseDateToISO(t.iso);
      if (!parsed) {
        // skip if somehow invalid
        results.skipped++;
        continue;
      }

      // try exact match
      const { data: exact } = await db
        .from("songs")
        .select("id,title,artist,sequence,first_listen_date")
        .eq("norm_title", t.normTitle)
        .eq("norm_artist", t.normArtist)
        .limit(1)
        .maybeSingle();

      if (exact) {
        // update first_listen_date if the new date is earlier
        if (!exact.first_listen_date || parsed < exact.first_listen_date) {
          const { error: updErr } = await db
            .from("songs")
            .update({ first_listen_date: parsed })
            .eq("id", exact.id);
          if (updErr) console.error("Failed updating song date", updErr);
          else
            results.updated.push({
              id: exact.id,
              old: exact.first_listen_date,
              new: parsed,
            });
        } else {
          results.linked.push({ id: exact.id });
        }
        continue;
      }

      // No exact match -> compute insertion position by date
      // Count how many songs have a first_listen_date <= parsed (dated songs only)
      const { count } = await db
        .from("songs")
        .select("id", { count: "exact", head: true })
        .lte("first_listen_date", parsed)
        .not("first_listen_date", "is", null);
      const position = (typeof count === "number" ? count : 0) + 1;

      // shift sequences >= position by +1 (descending order to avoid conflicts)
      const { data: rowsToShift } = await db
        .from("songs")
        .select("id,sequence")
        .gte("sequence", position)
        .order("sequence", { ascending: false });

      if (rowsToShift && rowsToShift.length) {
        for (const row of rowsToShift) {
          const { error: shiftErr } = await db
            .from("songs")
            .update({ sequence: row.sequence + 1 })
            .eq("id", row.id);
          if (shiftErr)
            console.error("Failed shifting sequence for", row.id, shiftErr);
        }
      }

      // insert new song at position
      const newSong = {
        title: t.title,
        artist: t.artist,
        norm_title: t.normTitle,
        norm_artist: t.normArtist,
        first_listen_date: parsed,
        sequence: position,
        curated: true,
      };
      const { data: created, error: createErr } = await db
        .from("songs")
        .insert([newSong])
        .select()
        .maybeSingle();
      if (createErr) {
        console.error("Failed creating song", createErr, newSong);
      } else {
        results.created.push({ id: created.id, sequence: created.sequence });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("lastfm import failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
