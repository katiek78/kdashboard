"use client";

import React, { useState } from "react";
import styles from "./MySongList.module.css";
import supabase from "@/utils/supabaseClient";

export default function MySongList() {
  const [songs, setSongs] = useState([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageInput, setPageInput] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingSongs, setLoadingSongs] = useState(false);

  // keep the page input in sync when current page changes
  React.useEffect(() => {
    setPageInput(page);
  }, [page]);

  async function loadSongs(p = page, ps = pageSize) {
    setLoadingSongs(true);
    const from = (p - 1) * ps;
    const to = from + ps - 1;
    const { data, error, count } = await supabase
      .from("songs")
      .select("id,sequence,title,artist,first_listen_date,notes", {
        count: "exact",
      })
      .order("sequence", { ascending: true })
      .range(from, to);
    setLoadingSongs(false);
    if (error) {
      console.error("loadSongs error", error);
      return;
    }
    setSongs(data || []);
    setTotalCount(count || 0);

    // If requested page is out of range, move to last available page
    const totalPages = Math.max(1, Math.ceil((count || 0) / ps));
    if (p > totalPages) {
      setPage(totalPages);
      await loadSongs(totalPages, ps);
    }
  }

  async function addSong() {
    if (!title.trim()) return;
    // compute next sequence
    const { data: seqData, error: seqErr } = await supabase.rpc("max_sequence");
    let maxSeq = 0;
    if (!seqErr && seqData && seqData.length && seqData[0].max)
      maxSeq = seqData[0].max || 0;
    const newSong = {
      title: title.trim(),
      artist: artist.trim(),
      norm_title: (title || "").toLowerCase().trim(),
      norm_artist: (artist || "").toLowerCase().trim(),
      sequence: maxSeq + 1,
      curated: true,
    };
    const { data, error } = await supabase
      .from("songs")
      .insert([newSong])
      .select()
      .maybeSingle();
    if (error) {
      console.error("addSong error", error);
      alert("Failed to add song: " + (error.message || JSON.stringify(error)));
    } else {
      setTitle("");
      setArtist("");
      await loadSongs();
    }
  }

  async function removeSong(id) {
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) console.error("removeSong error", error);
    await loadSongs();
  }

  async function saveSongNotes(id) {
    try {
      // prefer reading from uncontrolled input refs when editing (avoids frequent re-renders while typing)
      const titleVal =
        songTitleRef.current && songTitleRef.current.value !== undefined
          ? songTitleRef.current.value
          : songTitleDraft;
      const artistVal =
        songArtistRef.current && songArtistRef.current.value !== undefined
          ? songArtistRef.current.value
          : songArtistDraft;
      const notesVal =
        songNotesRef.current && songNotesRef.current.value !== undefined
          ? songNotesRef.current.value
          : songNotesDraft;

      const payload = {
        title: titleVal,
        artist: artistVal,
        notes: notesVal,
        norm_title: (titleVal || "").toLowerCase().trim(),
        norm_artist: (artistVal || "").toLowerCase().trim(),
      };

      const { data, error } = await supabase
        .from("songs")
        .update(payload)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) {
        console.error("saveSongNotes error", error);
        alert(
          "Failed to save song: " + (error.message || JSON.stringify(error))
        );
        return;
      }
      setEditingSongId(null);
      setSongNotesDraft("");
      setSongTitleDraft("");
      setSongArtistDraft("");

      // clear refs' DOM values if they exist (safe no-op if unmounted)
      if (songTitleRef.current) songTitleRef.current.value = "";
      if (songArtistRef.current) songArtistRef.current.value = "";
      if (songNotesRef.current) songNotesRef.current.value = "";

      await loadSongs();
    } catch (err) {
      console.error("saveSongNotes exception", err);
      alert("Failed to save song");
    }
  }

  // Import review state
  const [pendingImportRows, setPendingImportRows] = useState([]);
  const [latestImportId, setLatestImportId] = useState(null);

  // song notes & title/artist editing state
  const [editingSongId, setEditingSongId] = useState(null);
  const [songNotesDraft, setSongNotesDraft] = useState("");
  const [songTitleDraft, setSongTitleDraft] = useState("");
  const [songArtistDraft, setSongArtistDraft] = useState("");

  // refs for uncontrolled edit inputs to avoid frequent re-renders while typing
  const songTitleRef = React.useRef(null);
  const songArtistRef = React.useRef(null);
  const songNotesRef = React.useRef(null);

  async function loadPendingImportRows() {
    // fetch latest import for this user
    const { data: impData, error: impErr } = await supabase
      .from("imports")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (impErr) {
      console.error("loadPendingImportRows import fetch error", impErr);
      return;
    }
    if (!impData) {
      setPendingImportRows([]);
      setLatestImportId(null);
      return;
    }
    const importId = impData.id;
    setLatestImportId(importId);
    const { data: rows, error: rowsErr } = await supabase
      .from("import_rows")
      .select(
        "id, mapped_title, mapped_artist, mapped_date, status, matched_song_id, raw, created_at, matched_song: songs(id,title,artist)"
      )
      .eq("import_id", importId)
      .in("status", ["ambiguous", "error"])
      .order("created_at", { ascending: true });

    if (rowsErr) {
      console.error("loadPendingImportRows rows error", rowsErr);
      return;
    }
    setPendingImportRows(rows || []);
  }

  // Import UI state
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [delimiter, setDelimiter] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingImport, setCreatingImport] = useState(false);

  async function handlePreview() {
    setLoadingPreview(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || sessionData?.access_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/music/import/preview", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: pasteText,
          hasHeader,
          delimiter: delimiter || null,
        }),
      });
      const data = await res.json();
      if (res.ok) setPreview(data);
      else alert(data.error || "Preview failed");
    } catch (err) {
      console.error(err);
      alert("Preview error");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleCreateImport() {
    if (!preview) return;
    setCreatingImport(true);
    try {
      // include the logged-in user's access token so server can perform actions under their identity (RLS uses auth.uid())
      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || sessionData?.access_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/music/import/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: pasteText,
          hasHeader,
          delimiter: delimiter || null,
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error(
          "Failed to parse JSON response from import create",
          parseErr
        );
      }

      if (res.ok) {
        alert("Import created: " + (data?.importId || "(no id returned)"));
        setShowImport(false);
        setPasteText("");
        setPreview(null);
        // refresh songs and pending import rows
        await loadSongs();
        await loadPendingImportRows();
      } else {
        console.error("Import create failed", res.status, data);
        const serverMsg = data
          ? data.error
            ? data.error
            : JSON.stringify(data)
          : `HTTP ${res.status}`;
        const details =
          data && data.details ? `\nDetails: ${data.details}` : "";
        alert(`${serverMsg}${details}`);
      }
    } catch (err) {
      console.error("Create import error", err);
      alert(
        "Create import error: " +
          (err && err.message ? err.message : String(err))
      );
    } finally {
      setCreatingImport(false);
    }
  }

  // load pending import rows on mount
  React.useEffect(() => {
    loadPendingImportRows();
  }, []);

  // load songs whenever page or pageSize changes
  React.useEffect(() => {
    loadSongs();
  }, [page, pageSize]);

  async function resolveImportRow(importRowId, action) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || sessionData?.access_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/music/import/review/resolve", {
        method: "POST",
        headers,
        body: JSON.stringify({ importRowId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadSongs();
        await loadPendingImportRows();
      } else {
        alert(data.error || "Failed resolving import row");
      }
    } catch (err) {
      console.error("resolveImportRow error", err);
      alert("Error resolving import row");
    }
  }

  // Memoized song item to reduce re-renders when typing in notes
  return (
    <div className={styles.container + " pageContainer"}>
      <h1>My song list</h1>

      <div className={styles.card}>
        <div className={styles.formRow}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
            className={styles.input}
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist"
            className={styles.input}
          />
          <button onClick={addSong} className={styles.addBtn}>
            Add
          </button>
          <button
            onClick={() => setShowImport((s) => !s)}
            className={styles.addBtn}
            style={{ marginLeft: "1rem" }}
          >
            Import (Paste)
          </button>
        </div>

        {showImport ? (
          <div style={{ marginTop: "1rem" }}>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste tab/CSV rows here"
              rows={8}
              style={{ width: "100%", padding: "0.75rem", borderRadius: 8 }}
            />
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                marginTop: "0.5rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  gap: "0.25rem",
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                />{" "}
                Has header row
              </label>
              <input
                placeholder="Delimiter (leave blank to auto-detect)"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                style={{ width: 200 }}
              />
              <button
                onClick={handlePreview}
                className={styles.addBtn}
                disabled={loadingPreview}
              >
                {loadingPreview ? "Previewing…" : "Preview"}
              </button>
              <button
                onClick={handleCreateImport}
                className={styles.addBtn}
                disabled={creatingImport || !preview}
              >
                {creatingImport ? "Creating…" : "Create Import"}
              </button>
            </div>

            {preview ? (
              <div
                style={{ marginTop: "1rem", maxHeight: 300, overflow: "auto" }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Date</th>
                      <th>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((r) => (
                      <tr key={r.rowIndex}>
                        <td style={{ padding: "0.25rem 0.5rem" }}>
                          {r.rowIndex + 1}
                        </td>
                        <td style={{ padding: "0.25rem 0.5rem" }}>{r.title}</td>
                        <td style={{ padding: "0.25rem 0.5rem" }}>
                          {r.artist}
                        </td>
                        <td style={{ padding: "0.25rem 0.5rem" }}>{r.date}</td>
                        <td style={{ padding: "0.25rem 0.5rem" }}>
                          {r.exactMatch
                            ? `Existing (seq ${r.exactMatch.sequence}) — review`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Import Review Panel */}
            <div style={{ marginTop: "1rem" }}>
              <h3>Import Review</h3>
              {pendingImportRows.length === 0 ? (
                <p>No ambiguous or error rows for the latest import.</p>
              ) : (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {pendingImportRows.map((row) => (
                    <div key={row.id} className={styles.card}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <strong>{row.mapped_title}</strong>
                          <div style={{ fontSize: "0.9rem", color: "#d6bcfa" }}>
                            {row.mapped_artist}
                          </div>
                          <div
                            style={{ fontSize: "0.85rem", color: "#c4b5fd" }}
                          >
                            {row.mapped_date || "(no date)"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#a78bfa" }}>
                            Status: {row.status}
                          </div>
                          {row.matched_song ? (
                            <div style={{ fontSize: "0.85rem" }}>
                              Suggested match: {row.matched_song.title} —{" "}
                              {row.matched_song.artist}
                              {row.matched_song.sequence ? (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: "0.8rem",
                                    color: "#b4a6ff",
                                  }}
                                >
                                  Seq: {row.matched_song.sequence}
                                </span>
                              ) : null}
                              {row.matched_song.notes ? (
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "#b4a6ff",
                                  }}
                                >
                                  Notes: {row.matched_song.notes}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginLeft: 12,
                          }}
                        >
                          {row.status === "ambiguous" && row.matched_song ? (
                            <button
                              className={styles.addBtn}
                              onClick={() => resolveImportRow(row.id, "accept")}
                            >
                              Accept suggested
                            </button>
                          ) : null}
                          <button
                            className={styles.addBtn}
                            onClick={() => resolveImportRow(row.id, "create")}
                          >
                            Create new song
                          </button>
                          <button
                            className={styles.removeBtn}
                            onClick={() => resolveImportRow(row.id, "ignore")}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.list}>
        {songs.length === 0 ? (
          <p className={styles.empty}>No songs yet — add some!</p>
        ) : null}

        {songs.map((s) => (
          <div key={s.id} className={styles.songItem}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flex: 1,
              }}
            >
              <div className={styles.sequenceBadge}>{s.sequence}</div>
              <div style={{ flex: 1 }}>
                <strong>{s.title}</strong>
                <div className={styles.artist}>{s.artist}</div>

                {editingSongId === s.id ? (
                  <div style={{ marginTop: "0.5rem" }}>
                    <input
                      defaultValue={songTitleDraft}
                      ref={songTitleRef}
                      placeholder="Title"
                      className={styles.input}
                      style={{ marginBottom: "0.5rem" }}
                    />
                    <input
                      defaultValue={songArtistDraft}
                      ref={songArtistRef}
                      placeholder="Artist"
                      className={styles.input}
                      style={{ marginBottom: "0.5rem" }}
                    />
                    <textarea
                      defaultValue={songNotesDraft}
                      ref={songNotesRef}
                      rows={3}
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        padding: "0.5rem",
                        background: "rgba(20,10,30,0.4)",
                        color: "#e9d5ff",
                        border: "1px solid rgba(186,85,211,0.12)",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginTop: "0.5rem",
                      }}
                    >
                      <button
                        className={styles.addBtn}
                        onClick={() => saveSongNotes(s.id)}
                      >
                        Save
                      </button>
                      <button
                        className={styles.removeBtn}
                        onClick={() => {
                          setEditingSongId(null);
                          setSongNotesDraft("");
                          setSongTitleDraft("");
                          setSongArtistDraft("");
                          if (songTitleRef.current)
                            songTitleRef.current.value = "";
                          if (songArtistRef.current)
                            songArtistRef.current.value = "";
                          if (songNotesRef.current)
                            songNotesRef.current.value = "";
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : s.notes ? (
                  <div style={{ marginTop: "0.5rem", color: "#b4a6ff" }}>
                    {s.notes}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              {editingSongId !== s.id ? (
                <button
                  className={styles.addBtn}
                  onClick={() => {
                    setEditingSongId(s.id);
                    setSongNotesDraft(s.notes || "");
                    setSongTitleDraft(s.title || "");
                    setSongArtistDraft(s.artist || "");
                  }}
                >
                  Edit
                </button>
              ) : null}

              <button
                className={styles.removeBtn}
                onClick={() => removeSong(s.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.pagination}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginTop: "0.75rem",
          }}
        >
          <div style={{ color: "#d6bcfa" }}>
            {totalCount === 0
              ? "No songs"
              : `Showing ${
                  totalCount === 0 ? 0 : (page - 1) * pageSize + 1
                } - ${Math.min(page * pageSize, totalCount)} of ${totalCount}`}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {(() => {
              const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
              return (
                <>
                  <button
                    className={styles.removeBtn}
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                  >
                    First
                  </button>

                  <button
                    className={styles.removeBtn}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </button>

                  <span style={{ color: "#d6bcfa" }}>
                    Page {page} of {totalPages}
                  </span>

                  <button
                    className={styles.addBtn}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>

                  <button
                    className={styles.addBtn}
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                  >
                    Last
                  </button>

                  <input
                    type="number"
                    min={1}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    style={{
                      width: 80,
                      marginLeft: "0.5rem",
                      padding: "0.35rem",
                      borderRadius: 6,
                      background: "rgba(45,21,55,0.9)",
                      color: "#e9d5ff",
                      border: "1px solid rgba(186,85,211,0.25)",
                    }}
                  />
                  <button
                    className={styles.addBtn}
                    onClick={() => {
                      const n = Math.max(
                        1,
                        Math.min(totalPages, Number(pageInput) || 1)
                      );
                      setPage(n);
                    }}
                  >
                    Go
                  </button>

                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPage(1);
                      setPageSize(Number(e.target.value));
                    }}
                    style={{ marginLeft: "0.5rem" }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
