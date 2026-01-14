import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  detectDelimiter,
  parseTextToRows,
  normalizeString,
} from "@/lib/musicImportUtils";
import { parseDateToISO } from "@/lib/dateUtils";

export async function POST(req) {
  try {
    const body = await req.json();
    const text = body.text || "";
    const userDelimiter = body.delimiter || null;
    const hasHeader = !!body.hasHeader;

    if (!text.trim()) {
      return NextResponse.json({ error: "Empty text" }, { status: 400 });
    }

    const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
    const delimiter = userDelimiter || detectDelimiter(sample);

    const { headers, rows } = parseTextToRows(text, delimiter, hasHeader);

    let mapping = null;
    if (headers && headers.length > 0) {
      // map header names to known fields
      const lowerHeaders = headers.map((h) => h.toLowerCase());
      mapping = {
        title: lowerHeaders.findIndex(
          (h) => h.includes("title") || h.includes("song")
        ),
        artist: lowerHeaders.findIndex((h) => h.includes("artist")),
        date: lowerHeaders.findIndex(
          (h) => h.includes("date") || h.includes("first")
        ),
        notes: lowerHeaders.findIndex(
          (h) => h.includes("note") || h.includes("notes")
        ),
      };
    } else {
      // default positions: title, artist, date, notes
      mapping = { title: 0, artist: 1, date: 2, notes: 3 };
    }

    // Try to use provided auth token so RLS-based lookups can run as the user
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    let db = null;
    if (token) {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }

    const preview = [];
    const limit = Math.min(rows.length, 50);
    for (let i = 0; i < limit; i++) {
      const r = rows[i];
      const get = (idx) =>
        idx >= 0 && idx < r.parts.length ? r.parts[idx] : "";
      const title = get(mapping.title) || "";
      const artist = get(mapping.artist) || "";
      const dateRaw = get(mapping.date) || null;
      const notes = get(mapping.notes) || "";

      const normTitle = normalizeString(title);
      const normArtist = normalizeString(artist);

      let exact = null;
      if (db) {
        const { data: exactData } = await db
          .from("songs")
          .select("id, title, artist, sequence, first_listen_date")
          .eq("norm_artist", normArtist)
          .eq("norm_title", normTitle)
          .limit(1)
          .maybeSingle();
        exact = exactData || null;
      }

      const parsedIso = parseDateToISO(dateRaw);
      preview.push({
        rowIndex: i,
        title,
        artist,
        date: dateRaw,
        parsedDateIso: parsedIso, // normalized YYYY-MM-DD or null
        dateValid: parsedIso !== null,
        notes,
        normTitle,
        normArtist,
        exactMatch: exact
          ? {
              id: exact.id,
              sequence: exact.sequence,
              first_listen_date: exact.first_listen_date,
            }
          : null,
      });
    }

    return NextResponse.json({ preview, mapping, delimiter, headers });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
