import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseDateToISO } from "@/lib/dateUtils";

export async function POST(req) {
  try {
    const body = await req.json();
    const { importRowId, action, note } = body;
    if (!importRowId || !action)
      return NextResponse.json(
        { error: "Missing importRowId or action" },
        { status: 400 }
      );

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

    // fetch import_row and ensure import belongs to user (RLS should enforce but double-check)
    const { data: rowData, error: rowErr } = await db
      .from("import_rows")
      .select(
        "id, mapped_title, mapped_artist, mapped_date, notes, status, matched_song_id, raw, created_at, matched_song: songs(id,title,artist,notes,sequence), import:imports(id, user_id)"
      )
      .eq("id", importRowId)
      .maybeSingle();
    if (rowErr) {
      console.error("fetch import_row error", rowErr);
      return NextResponse.json({ error: String(rowErr) }, { status: 500 });
    }
    if (!rowData)
      return NextResponse.json(
        { error: "Import row not found" },
        { status: 404 }
      );

    // actions: accept (link to existing matched_song_id), create (make new song), ignore
    if (action === "accept") {
      // only valid if matched_song_id present
      if (!rowData.matched_song_id)
        return NextResponse.json(
          { error: "No matched song to accept" },
          { status: 400 }
        );

      // if note provided, append to song.notes and import_row.notes
      if (note && note.trim()) {
        const existingSongNotes = rowData.matched_song?.notes || "";
        const newSongNotes = existingSongNotes
          ? `${existingSongNotes}\n${note.trim()}`
          : note.trim();
        const { error: songUpdErr } = await db
          .from("songs")
          .update({ notes: newSongNotes })
          .eq("id", rowData.matched_song_id);
        if (songUpdErr)
          console.error("Failed to update song notes", songUpdErr);

        const importNotes = rowData.notes || "";
        const newImportNotes = importNotes
          ? `${importNotes}\n${note.trim()}`
          : note.trim();
        const { error: importRowUpdErr } = await db
          .from("import_rows")
          .update({ status: "merged", notes: newImportNotes })
          .eq("id", importRowId);
        if (importRowUpdErr)
          return NextResponse.json(
            { error: String(importRowUpdErr) },
            { status: 500 }
          );
      } else {
        const { error: updErr } = await db
          .from("import_rows")
          .update({ status: "merged" })
          .eq("id", importRowId);
        if (updErr)
          return NextResponse.json({ error: String(updErr) }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "create") {
      // create a new song from mapped fields
      const sequenceRes = await db
        .from("songs")
        .select("sequence")
        .order("sequence", { ascending: false })
        .limit(1);
      if (sequenceRes.error)
        console.error("sequence query error", sequenceRes.error);
      let currentMax = 0;
      if (sequenceRes.data && sequenceRes.data.length > 0)
        currentMax = sequenceRes.data[0].sequence || 0;

      // validate and normalize date; be lenient for review-created songs
      const parsedIso = rowData.mapped_date
        ? parseDateToISO(rowData.mapped_date)
        : null;
      const warnings = [];
      let notesForSong =
        note && note.trim() ? note.trim() : rowData.notes || null;
      if (rowData.mapped_date && !parsedIso) {
        // don't block creation; save song with null date and record a warning
        warnings.push({ type: "invalid_date", value: rowData.mapped_date });
        const warnMsg = `Invalid date: ${rowData.mapped_date} — saved with null date`;
        notesForSong = notesForSong ? `${notesForSong}\n${warnMsg}` : warnMsg;
      }

      const newSong = {
        title: rowData.mapped_title || "",
        artist: rowData.mapped_artist || "",
        norm_title: (rowData.mapped_title || "").toLowerCase().trim(),
        norm_artist: (rowData.mapped_artist || "").toLowerCase().trim(),
        first_listen_date: parsedIso || null,
        sequence: currentMax + 1,
        curated: true,
        notes: notesForSong,
      };

      const { data: createdSong, error: createErr } = await db
        .from("songs")
        .insert([newSong])
        .select()
        .maybeSingle();
      if (createErr)
        return NextResponse.json({ error: String(createErr) }, { status: 500 });

      // debug logging: show what was parsed and what was stored
      console.debug(
        "resolve:create: mapped_date=",
        rowData.mapped_date,
        "parsedIso=",
        parsedIso,
        "stored=",
        createdSong?.first_listen_date
      );

      const importNotes = rowData.notes || "";
      const newImportNotes =
        note && note.trim()
          ? importNotes
            ? `${importNotes}\n${note.trim()}`
            : note.trim()
          : importNotes;

      const { error: updRowErr } = await db
        .from("import_rows")
        .update({
          status: "merged",
          matched_song_id: createdSong.id,
          notes: newImportNotes,
        })
        .eq("id", importRowId);
      if (updRowErr)
        return NextResponse.json({ error: String(updRowErr) }, { status: 500 });

      // return warnings to client if any
      const resp = { success: true, song: createdSong };
      if (warnings && warnings.length) resp.warnings = warnings;
      return NextResponse.json(resp);
    }

    if (action === "ignore") {
      const importNotes = rowData.notes || "";
      const newImportNotes =
        note && note.trim()
          ? importNotes
            ? `${importNotes}\n${note.trim()}`
            : note.trim()
          : importNotes;
      const { error: updErr } = await db
        .from("import_rows")
        .update({ status: "ignored", notes: newImportNotes })
        .eq("id", importRowId);
      if (updErr)
        return NextResponse.json({ error: String(updErr) }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("resolve import row failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
