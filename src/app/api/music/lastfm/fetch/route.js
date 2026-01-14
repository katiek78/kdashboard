import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeString } from "@/lib/musicImportUtils";

export async function POST(req) {
  try {
    const body = await req.json();
    const username = (body.username || "").trim();
    const page = Number(body.page || 1);
    const limit = Math.min(200, Number(body.limit || 50));
    const from = body.from || null; // unix seconds
    const to = body.to || null; // unix seconds
    const includeMatches = !!body.includeMatches;

    if (!username) {
      return NextResponse.json(
        { error: "Missing last.fm username" },
        { status: 400 }
      );
    }

    const key =
      process.env.LASTFM_API_KEY || process.env.NEXT_PUBLIC_LASTFM_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Missing Last.fm API key on server" },
        { status: 500 }
      );
    }

    const ua = process.env.NEXT_PUBLIC_APP_NAME
      ? `${process.env.NEXT_PUBLIC_APP_NAME} lastfm-import`
      : "kdashboard lastfm-import";

    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "user.getrecenttracks");
    url.searchParams.set("user", username);
    url.searchParams.set("api_key", key);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", String(page));
    if (from) url.searchParams.set("from", String(from));
    if (to) url.searchParams.set("to", String(to));

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": ua },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Last.fm responded ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const payload = await res.json();
    if (!payload || !payload.recenttracks) {
      return NextResponse.json(
        { error: "Unexpected Last.fm response" },
        { status: 502 }
      );
    }

    const attr = payload.recenttracks["@attr"] || {};
    const totalPages = Number(attr.totalPages || 1);
    const total = Number(attr.total || 0);

    const rawTracks = payload.recenttracks.track || [];

    const tracks = rawTracks.map((t, idx) => {
      const title = t.name || "";
      const artist = (t.artist && (t.artist["#text"] || t.artist.name)) || "";
      const dateObj = t.date || null; // may be undefined for nowplaying
      const unix = dateObj && dateObj.uts ? Number(dateObj.uts) : null;
      const iso = unix
        ? new Date(unix * 1000).toISOString().split("T")[0]
        : null;
      return {
        idx: idx,
        title,
        artist,
        unix,
        isoDate: iso,
        normTitle: normalizeString(title),
        normArtist: normalizeString(artist),
        nowplaying: !!t["@attr"] && t["@attr"].nowplaying === "true",
      };
    });

    // Per-user preference: filter out tracks without timestamps (e.g., nowplaying) and sort oldest -> newest
    const filtered = tracks
      .filter((t) => t.unix !== null)
      .sort((a, b) => a.unix - b.unix);

    // Optionally run exact-match suggestions in user-scoped DB context if provided
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    let db = null;
    if (includeMatches && token) {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }

    if (db) {
      // run lookups in batches on filtered (dated) tracks
      for (let i = 0; i < filtered.length; i++) {
        const t = filtered[i];
        try {
          const { data: exact } = await db
            .from("songs")
            .select("id,title,artist,sequence,first_listen_date")
            .eq("norm_title", t.normTitle)
            .eq("norm_artist", t.normArtist)
            .limit(1)
            .maybeSingle();
          if (exact) {
            t.match = { type: "exact", song: exact };
          }
        } catch (e) {
          console.error("Last.fm fetch match error", e);
        }
      }
    }

    return NextResponse.json({
      tracks: filtered,
      page,
      totalPages,
      total,
      perPage: limit,
    });
  } catch (err) {
    console.error("lastfm fetch failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
