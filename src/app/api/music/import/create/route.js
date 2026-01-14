import { NextResponse } from "next/server";
import supabase from "@/utils/supabaseClient";
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

    // simple header mapping
    let mapping = null;
    if (headers && headers.length > 0) {
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
      mapping = { title: 0, artist: 1, date: 2, notes: 3 };
    }

    // Require authentication token (we need a user session for RLS checks)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Create a user-scoped supabase client using the provided access token
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // verify token and get user id
    const { data: userData, error: userErr } =
      await supabaseUser.auth.getUser();
    if (userErr || !userData || !userData.user) {
      console.error("Invalid auth token", userErr);
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }
    const uid = userData.user.id;

    const db = supabaseUser; // use user-scoped client for DB operations

    // create import record (tied to user)
    const { data: importData, error: importErr } = await db
      .from("imports")
      .insert([
        { source: "sheet", user_id: uid, metadata: { rowCount: rows.length } },
      ])
      .select()
      .maybeSingle();
    if (importErr) throw importErr;
    const importId = importData.id;

    // For paste import, sequence is assigned from the paste order (first pasted row gets the next sequence).
    // Rows without a date are inserted in place and should remain in their pasted positions; we don't set a separate lock column for them.

    // get current max sequence via user-scoped client
    let currentMax = 0;
    try {
      const { data: seqData, error: seqErr } = await db.rpc("max_sequence");
      if (seqErr) {
        console.error("max_sequence rpc error", seqErr);
      } else if (seqData && seqData.length > 0 && seqData[0].max) {
        currentMax = parseInt(seqData[0].max, 10) || 0;
      }
    } catch (rpcErr) {
      console.error("RPC call failed", rpcErr);
    }

    // fallback if RPC not present or returned nothing - run raw select
    if (!currentMax) {
      const { data: qdata, error: qerr } = await db
        .from("songs")
        .select("sequence")
        .order("sequence", { ascending: false })
        .limit(1);
      if (qerr) console.error("sequence fallback query error", qerr);
      if (qdata && qdata.length > 0) currentMax = qdata[0].sequence || 0;
    }

    // process rows sequentially (could be optimized later)
    console.log("Import request received", { rowCount: rows.length });
    const importRowInserts = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const get = (idx) =>
          idx >= 0 && idx < r.parts.length ? r.parts[idx] : "";
        const title = get(mapping.title) || "";
        const artist = get(mapping.artist) || "";
        const dateRaw = get(mapping.date) || null;
        const notes = get(mapping.notes) || "";

        const normTitle = normalizeString(title);
        const normArtist = normalizeString(artist);

        // try exact match; if found, mark for review (don't auto-merge)
        const { data: exact, error: exactErr } = await db
          .from("songs")
          .select("id, title, artist, sequence, first_listen_date")
          .eq("norm_artist", normArtist)
          .eq("norm_title", normTitle)
          .limit(1)
          .maybeSingle();

        // parse date using day-first rules (reject MM/DD formats)
        const parsedIso = parseDateToISO(dateRaw);

        if (dateRaw && !parsedIso) {
          // invalid date provided - record an error row and skip creating the song
          importRowInserts.push({
            import_id: importId,
            raw: { original: r.original, error: `Invalid date: ${dateRaw}` },
            mapped_title: title,
            mapped_artist: artist,
            mapped_date: dateRaw,
            notes,
            status: "error",
          });
          continue; // move to next row
        }

        if (exact) {
          importRowInserts.push({
            import_id: importId,
            raw: { original: r.original },
            mapped_title: title,
            mapped_artist: artist,
            mapped_date: dateRaw,
            notes,
            status: "ambiguous", // requires user review: exact match found
            matched_song_id: exact.id,
            confidence: 1.0,
          });
        } else {
          // create new song (no matching during paste import)
          currentMax += 1;

          const { data: createdSong, error: createSongErr } = await db
            .from("songs")
            .insert([
              {
                title,
                artist,
                norm_title: normTitle,
                norm_artist: normArtist,
                first_listen_date: parsedIso || null,
                sequence: currentMax,
                curated: true,
                notes: notes || null,
              },
            ])
            .select()
            .maybeSingle();

          if (createSongErr) {
            console.error("Create song error", createSongErr, {
              row: i,
              title,
              artist,
            });
            importRowInserts.push({
              import_id: importId,
              raw: {
                original: r.original,
                error: createSongErr.message || String(createSongErr),
              },
              mapped_title: title,
              mapped_artist: artist,
              mapped_date: dateRaw,
              notes,
              status: "error",
            });
          } else {
            importRowInserts.push({
              import_id: importId,
              raw: { original: r.original },
              mapped_title: title,
              mapped_artist: artist,
              mapped_date: dateRaw,
              notes,
              status: "merged",
              matched_song_id: createdSong.id,
              confidence: 1.0,
            });
          }
        }
      } catch (rowErr) {
        console.error("Error processing import row", i, rowErr);
        importRowInserts.push({
          import_id: importId,
          raw: { original: r.original, error: String(rowErr) },
          mapped_title: null,
          mapped_artist: null,
          mapped_date: null,
          notes: null,
          status: "error",
        });
      }
    }

    // bulk insert import_rows
    if (importRowInserts.length > 0) {
      const { error: bulkErr } = await db
        .from("import_rows")
        .insert(importRowInserts);
      if (bulkErr) {
        console.error("insert import rows error", bulkErr);
        const details =
          bulkErr && bulkErr.message
            ? bulkErr.message
            : JSON.stringify(bulkErr);
        // mark import failed with details
        await db
          .from("imports")
          .update({ status: "failed", metadata: { error: details } })
          .eq("id", importId);
        return NextResponse.json(
          {
            error: "Failed inserting import rows",
            details,
            rowsAttempted: importRowInserts.length,
          },
          { status: 500 }
        );
      }
    }

    // mark import completed
    try {
      const { error: updErr } = await db
        .from("imports")
        .update({
          status: "completed",
          metadata: { importedRows: importRowInserts.length },
        })
        .eq("id", importId);
      if (updErr) console.error("Failed to mark import completed", updErr);
    } catch (e) {
      console.error("Error marking import completed", e);
    }

    return NextResponse.json({
      importId,
      importedRows: importRowInserts.length,
    });
  } catch (err) {
    console.error("Import create failed", err);
    let message = "Unknown error";
    try {
      if (err && err.message) message = err.message;
      else message = JSON.stringify(err);
    } catch (e) {
      message = String(err);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
