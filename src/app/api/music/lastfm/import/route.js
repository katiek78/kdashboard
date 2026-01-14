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
          fetched.push({ title, artist, isoDate: iso, unix });
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
        unix: t.unix || null,
        normTitle: normalizeString(t.title || ""),
        normArtist: normalizeString(t.artist || ""),
      }))
      .filter((t) => t.iso);

    // sort oldest -> newest by unix if available, otherwise by iso
    good.sort((a, b) => {
      if (a.unix != null && b.unix != null) return a.unix - b.unix;
      if (a.unix != null) return -1;
      if (b.unix != null) return 1;
      return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0;
    });

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

      const uniqueCount = new Set(
        good.map((g) => `${g.normTitle}|||${g.normArtist}`)
      ).size;
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
            .select("id,first_listen_date,title,artist,sequence")
            .eq("norm_title", g.normTitle)
            .eq("norm_artist", g.normArtist)
            .limit(1)
            .maybeSingle();
          if (exact) existing[key] = exact;
        } catch (e) {
          console.error("Dry-run lookup error", e);
        }
      }

      // Build per-unique-track decisions in order of first occurrence
      const decisions = [];
      const seen = { ...existing };
      const uniqueMap = {};
      const firstOrder = [];
      for (const g of good) {
        const key = `${g.normTitle}|||${g.normArtist}`;
        if (!uniqueMap[key]) {
          uniqueMap[key] = g;
          firstOrder.push(key);
        }
      }

      // Track reserved insertion positions to ensure multiple creates/updates don't claim the same position.
      const reservedPositions = new Set();
      const reservePosition = (desired) => {
        let p = typeof desired === "number" && desired > 0 ? desired : 1;
        while (reservedPositions.has(p)) p++;
        reservedPositions.add(p);
        return p;
      };

      let orderCounter = 1;
      for (const key of firstOrder) {
        const g = uniqueMap[key];
        const parsed = parseDateToISO(g.iso);
        if (!parsed) {
          plan.skipped++;
          decisions.push({
            action: "skip",
            title: g.title,
            artist: g.artist,
            iso: g.iso,
            order: orderCounter++,
          });
          continue;
        }

        const prior = seen[key];
        if (prior) {
          const priorDate = prior.first_listen_date || null;

          if (priorDate) {
            // Existing song has a date: compare dates as before
            if (parsed < priorDate) {
              plan.wouldUpdate++;
              decisions.push({
                key: `${g.normTitle}|||${g.normArtist}`,
                action: "update",
                title: g.title,
                artist: g.artist,
                iso: g.iso,
                existingId: prior.id || null,
                existingFirstListenDate: priorDate || null,
                existingSequence: prior.sequence || null,
                wouldUpdateTo: parsed,
                order: orderCounter++,
              });
              seen[key] = { ...prior, first_listen_date: parsed };
            } else {
              plan.wouldLink++;
              decisions.push({
                key: `${g.normTitle}|||${g.normArtist}`,
                action: "link",
                title: g.title,
                artist: g.artist,
                iso: g.iso,
                existingId: prior.id || null,
                existingFirstListenDate: priorDate || null,
                existingSequence: prior.sequence || null,
                order: orderCounter++,
              });
            }
          } else {
            // Existing song has no date; infer using sequence position in DB
            try {
              // find last dated song <= parsed and use its sequence; if none, use max sequence (append)
              const { data: lastDated } = await db
                .from("songs")
                .select("sequence")
                .lte("first_listen_date", parsed)
                .not("first_listen_date", "is", null)
                .order("first_listen_date", { ascending: false })
                .order("sequence", { ascending: false })
                .limit(1);
              let lastSeq =
                lastDated && lastDated.length ? lastDated[0].sequence : null;
              if (lastSeq == null) {
                const { data: maxSeqRows } = await db
                  .from("songs")
                  .select("sequence")
                  .order("sequence", { ascending: false })
                  .limit(1);
                lastSeq =
                  maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
              }

              const rawPos = lastSeq + 1;
              const existingSeq =
                typeof prior.sequence === "number" ? prior.sequence : null;

              // if existing sequence is <= lastSeq, it is earlier (link), else update
              if (existingSeq !== null && existingSeq <= lastSeq) {
                plan.wouldLink++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "link",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: null,
                  existingSequence: existingSeq,
                  order: orderCounter++,
                });
              } else {
                const insertionPosition = reservePosition(rawPos);
                plan.wouldUpdate++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "update",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: null,
                  existingSequence: prior.sequence || null,
                  wouldUpdateTo: parsed,
                  insertionPosition,
                  order: orderCounter++,
                });
                seen[key] = { ...prior, first_listen_date: parsed };
              }
            } catch (e) {
              console.error("Dry-run position lookup error", e);
              // fallback to link
              plan.wouldLink++;
              decisions.push({
                action: "link",
                title: g.title,
                artist: g.artist,
                iso: g.iso,
                existingId: prior.id || null,
                existingFirstListenDate: null,
                existingSequence: prior.sequence || null,
                order: orderCounter++,
              });
            }
          }
        } else {
          // compute insertion position for created entry
          let insertionPosition = null;
          try {
            // find last dated song <= parsed and use its sequence
            const { data: lastDated } = await db
              .from("songs")
              .select("sequence")
              .lte("first_listen_date", parsed)
              .not("first_listen_date", "is", null)
              .order("first_listen_date", { ascending: false })
              .order("sequence", { ascending: false })
              .limit(1);
            let lastSeq =
              lastDated && lastDated.length ? lastDated[0].sequence : null;
            if (lastSeq == null) {
              const { data: maxSeqRows } = await db
                .from("songs")
                .select("sequence")
                .order("sequence", { ascending: false })
                .limit(1);
              lastSeq =
                maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
            }
            const rawPos = lastSeq + 1;
            insertionPosition = reservePosition(rawPos);
          } catch (e) {
            console.error("Dry-run insertion position error", e);
          }

          // Before creating, check for suggestions.
          // Prefer exact normalized title matches (title-only match) to surface a link option when titles align.
          let suggestion = null;
          try {
            // Try exact norm_title matches first (title-only candidates)
            const { data: titleMatches = [] } = await db
              .from("songs")
              .select(
                "id,title,artist,sequence,first_listen_date,norm_title,norm_artist"
              )
              .eq("norm_title", g.normTitle)
              .limit(20);

            if (titleMatches && titleMatches.length) {
              // prefer a candidate whose norm_artist matches exactly when possible
              let chosen =
                titleMatches.find((c) => c.norm_artist === g.normArtist) ||
                titleMatches[0];
              suggestion = {
                id: chosen.id,
                title: chosen.title,
                artist: chosen.artist,
                score: 0.995,
                matchType: "titleOnly",
              };
            } else {
              // fallback to fuzzy suggestions
              const token =
                g.normTitle.split(" ")[0] || g.normArtist.split(" ")[0] || "";
              const tokenLike = `%${token}%`;
              const { data: candidates = [] } = await db
                .from("songs")
                .select(
                  "id,title,artist,sequence,first_listen_date,norm_title,norm_artist"
                )
                .or(
                  `norm_title.ilike.${tokenLike},norm_artist.ilike.${tokenLike}`
                )
                .limit(50);

              let best = null;
              for (const c of candidates) {
                const titleScore = similarityScore(
                  g.normTitle,
                  c.norm_title || ""
                );
                const artistScore = similarityScore(
                  g.normArtist,
                  c.norm_artist || ""
                );
                const score = titleScore * 0.65 + artistScore * 0.35;
                if (!best || score > best.score) best = { score, candidate: c };
              }
              if (best && best.score >= 0.68) {
                suggestion = {
                  id: best.candidate.id,
                  title: best.candidate.title,
                  artist: best.candidate.artist,
                  score: Number(best.score.toFixed(3)),
                  matchType: "fuzzy",
                };
              }
            }
          } catch (e) {
            console.error("Dry-run suggestion lookup error", e);
          }

          plan.wouldCreate++;
          const decision = {
            key: `${g.normTitle}|||${g.normArtist}`,
            action: "create",
            title: g.title,
            artist: g.artist,
            iso: g.iso,
            insertionPosition,
            order: orderCounter++,
          };
          if (suggestion) decision.suggestion = suggestion;
          decisions.push(decision);

          // simulate creation
          seen[key] = { created: true, first_listen_date: parsed };
        }
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        plan,
        decisions,
        sample: good.slice(0, 15),
      });
    }

    const overrides = body.overrides || {};
    const results = { created: [], updated: [], linked: [], skipped: 0 };

    for (const t of good) {
      const key = `${t.normTitle}|||${t.normArtist}`;
      const parsed = parseDateToISO(t.iso);
      if (!parsed) {
        // skip if somehow invalid
        results.skipped++;
        continue;
      }

      // check user overrides for this unique key
      const override = overrides[key] || null;

      // try exact match (unless override forces create)
      let exact = null;
      if (!override || override.action !== "create") {
        if (override && override.action === "link" && override.existingId) {
          // use provided existing id as the exact match target
          const { data: byId } = await db
            .from("songs")
            .select("id,title,artist,sequence,first_listen_date")
            .eq("id", override.existingId)
            .limit(1)
            .maybeSingle();
          exact = byId || null;
        } else {
          const { data } = await db
            .from("songs")
            .select("id,title,artist,sequence,first_listen_date")
            .eq("norm_title", t.normTitle)
            .eq("norm_artist", t.normArtist)
            .limit(1)
            .maybeSingle();
          exact = data || null;
        }
      }

      if (exact) {
        // If existing record has a first_listen_date, compare dates as before
        if (exact.first_listen_date) {
          if (parsed < exact.first_listen_date) {
            const { error: updErr } = await db
              .from("songs")
              .update({ first_listen_date: parsed })
              .eq("id", exact.id);
            if (updErr) console.error("Failed updating song date", updErr);
            else
              results.updated.push({
                id: exact.id,
                title: exact.title,
                artist: exact.artist,
                old: exact.first_listen_date,
                new: parsed,
              });
          } else {
            results.linked.push({
              id: exact.id,
              title: exact.title,
              artist: exact.artist,
            });
          }
          continue;
        }

        // No existing date: infer using sequence position (find last dated song <= parsed, else append)
        try {
          const { data: lastDated } = await db
            .from("songs")
            .select("sequence")
            .lte("first_listen_date", parsed)
            .not("first_listen_date", "is", null)
            .order("first_listen_date", { ascending: false })
            .order("sequence", { ascending: false })
            .limit(1);
          let lastSeq =
            lastDated && lastDated.length ? lastDated[0].sequence : null;
          if (lastSeq == null) {
            const { data: maxSeqRows } = await db
              .from("songs")
              .select("sequence")
              .order("sequence", { ascending: false })
              .limit(1);
            lastSeq =
              maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
          }

          const existingSeq =
            typeof exact.sequence === "number" ? exact.sequence : null;

          // if existingSeq is <= lastSeq, treat existing as earlier (link). Otherwise update.
          if (existingSeq !== null && existingSeq <= lastSeq) {
            results.linked.push({
              id: exact.id,
              title: exact.title,
              artist: exact.artist,
            });
          } else {
            const { error: updErr } = await db
              .from("songs")
              .update({ first_listen_date: parsed })
              .eq("id", exact.id);
            if (updErr) console.error("Failed updating song date", updErr);
            else
              results.updated.push({
                id: exact.id,
                title: exact.title,
                artist: exact.artist,
                old: exact.first_listen_date,
                new: parsed,
              });
          }
          continue;
        } catch (e) {
          console.error("Position lookup error", e);
          // fallback: treat as linked
          results.linked.push({
            id: exact.id,
            title: exact.title,
            artist: exact.artist,
          });
          continue;
        }
      }

      // No exact match -> compute insertion position by date using sequence-aware approach
      // Find the latest dated song whose date <= parsed, use its sequence + 1 as insertion position
      const { data: lastDated } = await db
        .from("songs")
        .select("sequence")
        .lte("first_listen_date", parsed)
        .not("first_listen_date", "is", null)
        .order("first_listen_date", { ascending: false })
        .order("sequence", { ascending: false })
        .limit(1);
      let lastSeq =
        lastDated && lastDated.length ? lastDated[0].sequence : null;
      if (lastSeq == null) {
        const { data: maxSeqRows } = await db
          .from("songs")
          .select("sequence")
          .order("sequence", { ascending: false })
          .limit(1);
        lastSeq = maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
      }
      const position = lastSeq + 1;

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
        results.created.push({
          id: created.id,
          sequence: created.sequence,
          title: created.title,
          artist: created.artist,
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("lastfm import failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
