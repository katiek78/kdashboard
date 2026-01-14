"use client";

import React, { useState } from "react";
import styles from "./MySongList.module.css";
import supabase from "@/utils/supabaseClient";
import { parseDateToISO, formatISOToDisplay } from "@/lib/dateUtils";

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

      // read & validate date (prefer uncontrolled ref when present)
      const dateVal =
        songDateRef.current && songDateRef.current.value !== undefined
          ? songDateRef.current.value
          : songDateDraft;
      const parsedDateIso = dateVal ? parseDateToISO(dateVal) : null;
      if (dateVal && !parsedDateIso) {
        alert(
          "Invalid date format. Use DD/MM/YYYY or YYYY-MM-DD or textual months (e.g., 30 Jun 2005)."
        );
        return;
      }

      payload.first_listen_date = parsedDateIso || null;

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
      setSongDateDraft("");

      // clear refs' DOM values if they exist (safe no-op if unmounted)
      if (songTitleRef.current) songTitleRef.current.value = "";
      if (songArtistRef.current) songArtistRef.current.value = "";
      if (songNotesRef.current) songNotesRef.current.value = "";
      if (songDateRef.current) songDateRef.current.value = "";

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
  const songDateRef = React.useRef(null);
  const [songDateDraft, setSongDateDraft] = useState("");

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

  // Last.fm import state
  const [showLastFm, setShowLastFm] = useState(false);
  const [lfmUser, setLfmUser] = useState("");
  const [lfmFrom, setLfmFrom] = useState("");
  const [lfmTo, setLfmTo] = useState("");
  const [lfmLoading, setLfmLoading] = useState(false);
  const [lfmPreview, setLfmPreview] = useState(null);
  const [lfmPage, setLfmPage] = useState(1);
  const [lfmPerPage, setLfmPerPage] = useState(50);
  const [lfmAscending, setLfmAscending] = useState(true); // true => oldest -> newest
  const [lfmImporting, setLfmImporting] = useState(false);
  const [lastFmDryRun, setLastFmDryRun] = useState(null);
  const [lfmOverrides, setLfmOverrides] = useState({});
  const dryRunRef = React.useRef(null);
  const lfmUserRef = React.useRef(null);

  React.useEffect(() => {
    if (lastFmDryRun && dryRunRef.current) {
      try {
        dryRunRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } catch (e) {
        /* ignore */
      }
    }
  }, [lastFmDryRun]);

  React.useEffect(() => {
    if (showLastFm && lfmUserRef.current) {
      try {
        lfmUserRef.current.focus();
      } catch (e) {
        /* ignore */
      }
    }
  }, [showLastFm]);

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
        if (data.warnings && data.warnings.length) {
          const warnMsg = data.warnings
            .map((w) => w.type + ": " + w.value)
            .join("; ");
          const savedDate =
            data.song && data.song.first_listen_date
              ? `Saved date: ${data.song.first_listen_date}`
              : "";
          // don't alert the user for date formatting issues; log silently and refresh
          console.info(
            `Import row warning: ${warnMsg}${
              savedDate ? " — " + savedDate : ""
            }`
          );
        }
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

  // Last.fm helper: fetch recent tracks and optionally exact match against user's songs
  async function fetchLastFm(requestedPage = 1) {
    setLfmLoading(true);
    try {
      // convert date inputs (YYYY-MM-DD) to unix seconds in UTC
      const fromUnix = lfmFrom
        ? Math.floor(new Date(lfmFrom + "T00:00:00Z").getTime() / 1000)
        : null;
      const toUnix = lfmTo
        ? Math.floor(new Date(lfmTo + "T23:59:59Z").getTime() / 1000)
        : null;

      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || sessionData?.access_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/music/lastfm/fetch", {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: lfmUser,
          from: fromUnix,
          to: toUnix,
          page: requestedPage,
          limit: lfmPerPage,
          includeMatches: true,
        }),
      });
      const js = await res.json();
      if (!res.ok) {
        console.error("Last.fm fetch failed", js);
        alert(js.error || "Last.fm fetch failed");
        setLfmLoading(false);
        return;
      }
      setLfmPreview(js);
      setLfmPage(requestedPage);
    } catch (err) {
      console.error("fetchLastFm error", err);
      alert("Failed fetching Last.fm");
    } finally {
      setLfmLoading(false);
    }
  }

  async function importLastFm() {
    if (!lfmPreview || !lfmPreview.tracks || lfmPreview.tracks.length === 0) {
      alert("No tracks to import");
      return;
    }
    // Do a dry-run first to show exact counts (and avoid surprises)
    setLfmImporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || sessionData?.access_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // If we have a fuller preview with total, import across the whole date range by username
      const fromUnix = lfmFrom
        ? Math.floor(new Date(lfmFrom + "T00:00:00Z").getTime() / 1000)
        : null;
      const toUnix = lfmTo
        ? Math.floor(new Date(lfmTo + "T23:59:59Z").getTime() / 1000)
        : null;

      // Dry run first
      const dryRes = await fetch("/api/music/lastfm/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: lfmUser,
          from: fromUnix,
          to: toUnix,
          dryRun: true,
        }),
      });
      const dryJs = await dryRes.json();
      if (!dryRes.ok) {
        console.error("Dry run failed", dryJs);
        alert(dryJs.error || "Dry run failed");
        setLfmImporting(false);
        return;
      }

      if (dryJs && dryJs.dryRun && dryJs.plan) {
        const p = dryJs.plan;
        let msg = `Dry run: ${p.totalFetched} plays fetched (${p.datedCount} dated, ${p.uniqueCount} unique songs). This will import ${p.wouldCreate} unique new tracks (plus ${p.wouldUpdate} updates and ${p.wouldLink} no-update matches).`;

        // If we have per-track decisions, summarize them and include top items in the confirmation
        if (dryJs.decisions && Array.isArray(dryJs.decisions)) {
          const updates = dryJs.decisions.filter((d) => d.action === "update");
          const links = dryJs.decisions.filter((d) => d.action === "link");
          const creates = dryJs.decisions.filter((d) => d.action === "create");

          const createLines = creates.map(
            (c) => `CREATE: ${c.title} — ${c.artist} (${c.iso})`
          );
          const updateLines = updates.map(
            (u) =>
              `UPDATE: ${u.title} — ${u.artist} (${
                u.existingFirstListenDate || "(no date)"
              } → ${u.wouldUpdateTo})`
          );
          const linkLines = links.map(
            (l) =>
              `LINK: ${l.title} — ${l.artist} (existing ${
                l.existingFirstListenDate || "(no date)"
              })`
          );

          const details = [
            ...updateLines.slice(0, 20),
            ...linkLines.slice(0, 20),
            ...createLines.slice(0, 20),
          ];

          if (details.length > 0) {
            msg +=
              "\n\nTop decisions (showing up to 60 items):\n" +
              details.join("\n");
            msg += "\n\n(Full list is available in the browser console)";
          }

          // log full decisions for inspection
          console.log("Last.fm import dry-run decisions:", dryJs.decisions);
        }

        if (!confirm(msg)) {
          setLfmImporting(false);
          return;
        }
      }

      // Proceed with the real import
      const res = await fetch("/api/music/lastfm/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: lfmUser,
          from: fromUnix,
          to: toUnix,
          overrides: lfmOverrides,
        }),
      });
      const js = await res.json();
      if (!res.ok) {
        console.error("Import failed", js);
        alert(js.error || "Import failed");
      } else {
        const msg = formatImportResults(js.results);
        alert(msg);
        console.log("Last.fm import results:", js.results);
        await loadSongs();
        await loadPendingImportRows();
        setShowLastFm(false);
        setShowImport(false);
      }
    } catch (err) {
      console.error("importLastFm error", err);
      alert("Import failed");
    } finally {
      setLfmImporting(false);
    }
  }

  async function performDryRun() {
    if (!lfmUser) {
      alert("Enter a Last.fm username to run a dry run");
      return;
    }
    setLfmImporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || sessionData?.access_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const fromUnix = lfmFrom
        ? Math.floor(new Date(lfmFrom + "T00:00:00Z").getTime() / 1000)
        : null;
      const toUnix = lfmTo
        ? Math.floor(new Date(lfmTo + "T23:59:59Z").getTime() / 1000)
        : null;

      const dryRes = await fetch("/api/music/lastfm/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: lfmUser,
          from: fromUnix,
          to: toUnix,
          dryRun: true,
        }),
      });
      const dryJs = await dryRes.json();
      if (!dryRes.ok) {
        console.error("Dry run failed", dryJs);
        alert(dryJs.error || "Dry run failed");
        setLfmImporting(false);
        return;
      }

      if (dryJs && dryJs.dryRun && dryJs.plan) {
        setLastFmDryRun(dryJs);
        // initialize per-row overrides: default to suggestion link when available
        const ov = {};
        (dryJs.decisions || []).forEach((d) => {
          if (d.suggestion)
            ov[d.key] = { action: "link", existingId: d.suggestion.id };
        });
        setLfmOverrides(ov);
        console.log("Last.fm import dry-run decisions:", dryJs.decisions);
      }
    } catch (err) {
      console.error("performDryRun error", err);
      alert("Dry run failed");
    } finally {
      setLfmImporting(false);
    }
  }

  function formatImportResults(results) {
    if (!results) return "Import completed";
    const { created = [], updated = [], linked = [], skipped = 0 } = results;
    const lines = [];
    if (created.length) {
      lines.push(`Added (${created.length}):`);
      created.forEach((c) =>
        lines.push(`  • ${c.title} — ${c.artist} (seq ${c.sequence})`)
      );
    }
    if (updated.length) {
      lines.push(`Updated (${updated.length}):`);
      updated.forEach((u) =>
        lines.push(
          `  • ${u.title || u.id} — ${u.artist || ""} (${
            u.old || "(no date)"
          } → ${u.new})`
        )
      );
    }
    if (linked.length) {
      lines.push(`Linked (no change) (${linked.length}):`);
      linked.forEach((l) =>
        lines.push(`  • ${l.title || l.id} — ${l.artist || ""}`)
      );
    }
    if (skipped) lines.push(`Skipped: ${skipped}`);
    if (lines.length === 0) return `Import completed: no changes.`;
    lines.push("\nFull results logged to console.");
    return lines.join("\n");
  }

  async function performActualImport() {
    if (!lastFmDryRun) return;
    setLfmImporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || sessionData?.access_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const fromUnix = lfmFrom
        ? Math.floor(new Date(lfmFrom + "T00:00:00Z").getTime() / 1000)
        : null;
      const toUnix = lfmTo
        ? Math.floor(new Date(lfmTo + "T23:59:59Z").getTime() / 1000)
        : null;

      const res = await fetch("/api/music/lastfm/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: lfmUser,
          from: fromUnix,
          to: toUnix,
          overrides: lfmOverrides,
        }),
      });
      const js = await res.json();
      if (!res.ok) {
        console.error("Import failed", js);
        alert(js.error || "Import failed");
      } else {
        const msg = formatImportResults(js.results);
        alert(msg);
        console.log("Last.fm import results:", js.results);
        await loadSongs();
        await loadPendingImportRows();
        setShowLastFm(false);
        setShowImport(false);
        setLastFmDryRun(null);
        setLfmOverrides({});
      }
    } catch (err) {
      console.error("performActualImport error", err);
      alert("Import failed");
    } finally {
      setLfmImporting(false);
    }
  }

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
            onClick={() => {
              setShowLastFm(false);
              setShowImport((s) => !s);
            }}
            className={styles.addBtn}
            style={{ marginLeft: "1rem" }}
          >
            Import (Paste)
          </button>
          <button
            onClick={() => {
              setShowImport(true);
              setShowLastFm(true);
            }}
            className={styles.addBtn}
            style={{ marginLeft: "0.5rem" }}
          >
            Import (Last.fm)
          </button>
        </div>

        {showImport ? (
          <div style={{ marginTop: "1rem" }}>
            {!showLastFm && (
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste tab/CSV rows here"
                rows={8}
                style={{ width: "100%", padding: "0.75rem", borderRadius: 8 }}
              />
            )}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                marginTop: "0.5rem",
              }}
            >
              {!showLastFm && (
                <>
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

                  {/* Close button for Paste import */}
                  <button
                    className={styles.removeBtn}
                    onClick={() => {
                      setShowImport(false);
                      setPasteText("");
                      setPreview(null);
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    Close
                  </button>
                </>
              )}

              {showLastFm && (
                <div
                  style={{
                    marginLeft: "1rem",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    placeholder="Last.fm username"
                    ref={lfmUserRef}
                    value={lfmUser}
                    default="discokate"
                    onChange={(e) => setLfmUser(e.target.value)}
                    className={styles.input}
                    style={{ width: 200 }}
                  />
                  <input
                    type="date"
                    value={lfmFrom}
                    onChange={(e) => setLfmFrom(e.target.value)}
                    className={styles.input}
                  />
                  <input
                    type="date"
                    value={lfmTo}
                    onChange={(e) => setLfmTo(e.target.value)}
                    className={styles.input}
                  />
                  <button
                    className={styles.addBtn}
                    onClick={async () => {
                      // Fetch preview then run a full dry-run across the date range
                      await fetchLastFm(1);
                      await performDryRun();
                    }}
                    disabled={lfmLoading || lfmImporting || !lfmUser}
                  >
                    {lfmLoading || lfmImporting ? "Running…" : "Fetch Last.fm"}
                  </button>
                  <button
                    className={styles.removeBtn}
                    onClick={() => {
                      setShowLastFm(false);
                      setShowImport(false);
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    Close
                  </button>
                </div>
              )}
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

            {/* Last.fm preview */}
            {showLastFm ? (
              <div
                style={{ marginTop: "1rem", maxHeight: 300, overflow: "auto" }}
              >
                {lfmPreview ? (
                  <div>
                    <div
                      style={{
                        marginBottom: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        Showing page {lfmPage} of{" "}
                        {Math.max(
                          1,
                          Math.ceil((lfmPreview.total || 0) / lfmPerPage)
                        )}{" "}
                        — {lfmPreview.total || 0} total
                        <span
                          style={{ marginLeft: "0.75rem", color: "#d6bcfa" }}
                        >
                          ({lfmPreview.tracks.length} dated tracks shown —
                          skipping undated)
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ color: "#d6bcfa" }}>
                          {lfmAscending
                            ? "Showing oldest → newest"
                            : "Showing newest → oldest"}
                        </div>
                        <button
                          className={styles.addBtn}
                          onClick={() => setLfmAscending((s) => !s)}
                        >
                          Reverse
                        </button>
                        <button
                          className={styles.addBtn}
                          onClick={async () => {
                            if (lastFmDryRun) {
                              await performActualImport();
                            } else {
                              await performDryRun();
                            }
                          }}
                          disabled={
                            lfmImporting ||
                            !lfmPreview ||
                            !lfmPreview.tracks ||
                            lfmPreview.tracks.length === 0
                          }
                        >
                          {lfmImporting ? "Importing…" : "Import all"}
                        </button>
                      </div>
                    </div>

                    {lastFmDryRun ? (
                      <div
                        ref={dryRunRef}
                        style={{
                          marginBottom: "0.5rem",
                          padding: "0.5rem",
                          border: "1px solid #2a2a2a",
                          background: "#0f0f0f",
                          borderRadius: 6,
                        }}
                      >
                        <div
                          style={{
                            color: "#d6bcfa",
                            fontSize: 13,
                            marginBottom: 6,
                          }}
                        >
                          {`Dry run: ${lastFmDryRun.plan.totalFetched} plays fetched (${lastFmDryRun.plan.datedCount} dated, ${lastFmDryRun.plan.uniqueCount} unique). Will create ${lastFmDryRun.plan.wouldCreate}, update ${lastFmDryRun.plan.wouldUpdate}, link ${lastFmDryRun.plan.wouldLink}.`}
                        </div>
                        <div
                          style={{ display: "flex", gap: 8, marginBottom: 6 }}
                        >
                          <button
                            className={styles.addBtn}
                            onClick={() => setLastFmDryRun(null)}
                            disabled={lfmImporting}
                          >
                            Cancel
                          </button>
                          <button
                            className={styles.addBtn}
                            onClick={() => performActualImport()}
                            disabled={lfmImporting}
                          >
                            {lfmImporting ? "Importing…" : "Import all"}
                          </button>
                        </div>
                        <div
                          style={{
                            maxHeight: 200,
                            overflow: "auto",
                            fontSize: 13,
                            borderTop: "1px solid #1a1a1a",
                            paddingTop: 6,
                          }}
                        >
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                            }}
                          >
                            <thead>
                              <tr>
                                <th>Pos</th>
                                <th>Action</th>
                                <th>Date</th>
                                <th>Title</th>
                                <th>Artist</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(lastFmDryRun.decisions || [])
                                .slice()
                                .sort((a, b) => {
                                  // Prefer explicit order if provided by the server
                                  if (
                                    typeof a.order === "number" &&
                                    typeof b.order === "number"
                                  )
                                    return a.order - b.order;
                                  if (typeof a.order === "number") return -1;
                                  if (typeof b.order === "number") return 1;

                                  // Otherwise fallback to date then action priority
                                  if (a.iso && b.iso) {
                                    if (a.iso < b.iso) return -1;
                                    if (a.iso > b.iso) return 1;
                                    return 0;
                                  }
                                  if (a.iso) return -1;
                                  if (b.iso) return 1;
                                  const pri = {
                                    update: 1,
                                    create: 2,
                                    link: 3,
                                    skip: 4,
                                  };
                                  return (
                                    (pri[a.action] || 9) - (pri[b.action] || 9)
                                  );
                                })
                                .map((d, idx) => (
                                  <tr key={idx}>
                                    <td style={{ padding: "0.25rem 0.5rem" }}>
                                      {d.insertionPosition || ""}
                                    </td>
                                    <td style={{ padding: "0.25rem 0.5rem" }}>
                                      {d.action}
                                      {d.suggestion ? (
                                        <div
                                          style={{
                                            fontSize: 12,
                                            color: "#cfcfcf",
                                          }}
                                        >
                                          Suggestion: {d.suggestion.title} —{" "}
                                          {d.suggestion.artist}{" "}
                                          {d.suggestion.matchType ===
                                          "titleOnly" ? (
                                            <em style={{ color: "#f0c" }}>
                                              (title match)
                                            </em>
                                          ) : null}{" "}
                                          (score {d.suggestion.score})
                                        </div>
                                      ) : null}
                                      {/* per-row override controls */}
                                      {d.suggestion ? (
                                        <div style={{ marginTop: 6 }}>
                                          <label style={{ marginRight: 8 }}>
                                            <input
                                              type="radio"
                                              name={`ov-${d.key}`}
                                              checked={
                                                lfmOverrides[d.key]?.action ===
                                                "link"
                                              }
                                              onChange={() =>
                                                setLfmOverrides((s) => ({
                                                  ...s,
                                                  [d.key]: {
                                                    action: "link",
                                                    existingId: d.suggestion.id,
                                                  },
                                                }))
                                              }
                                            />{" "}
                                            Use suggestion
                                          </label>
                                          <label>
                                            <input
                                              type="radio"
                                              name={`ov-${d.key}`}
                                              checked={
                                                !lfmOverrides[d.key] ||
                                                lfmOverrides[d.key]?.action ===
                                                  "create"
                                              }
                                              onChange={() =>
                                                setLfmOverrides((s) => {
                                                  const n = { ...s };
                                                  delete n[d.key];
                                                  return n;
                                                })
                                              }
                                            />{" "}
                                            Create new
                                          </label>
                                        </div>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: "0.25rem 0.5rem" }}>
                                      {d.iso || "(no date)"}
                                    </td>
                                    <td style={{ padding: "0.25rem 0.5rem" }}>
                                      {d.title}
                                    </td>
                                    <td style={{ padding: "0.25rem 0.5rem" }}>
                                      {d.artist}
                                    </td>
                                    <td style={{ padding: "0.25rem 0.5rem" }}>
                                      {d.existingSequence
                                        ? `seq:${d.existingSequence}`
                                        : d.existingId
                                        ? `id:${d.existingId}`
                                        : ""}
                                      {d.existingFirstListenDate
                                        ? ` date:${d.existingFirstListenDate}`
                                        : ""}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}

                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Date</th>
                          <th>Title</th>
                          <th>Artist</th>
                          <th>Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(lfmAscending
                          ? lfmPreview.tracks
                          : [...lfmPreview.tracks].slice().reverse()
                        ).map((t, i) => (
                          <tr key={i}>
                            <td style={{ padding: "0.25rem 0.5rem" }}>
                              {(lfmPage - 1) * lfmPerPage + i + 1}
                            </td>
                            <td style={{ padding: "0.25rem 0.5rem" }}>
                              {t.isoDate ||
                                (t.nowplaying ? "now" : "(no date)")}
                            </td>
                            <td style={{ padding: "0.25rem 0.5rem" }}>
                              {t.title}
                            </td>
                            <td style={{ padding: "0.25rem 0.5rem" }}>
                              {t.artist}
                            </td>
                            <td style={{ padding: "0.25rem 0.5rem" }}>
                              {t.match
                                ? t.match.type === "exact"
                                  ? `Exact (seq ${t.match.song.sequence})`
                                  : "—"
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginTop: "0.5rem",
                      }}
                    >
                      <button
                        className={styles.removeBtn}
                        onClick={() => fetchLastFm(Math.max(1, lfmPage - 1))}
                        disabled={lfmPage <= 1}
                      >
                        Prev
                      </button>
                      <button
                        className={styles.addBtn}
                        onClick={() => fetchLastFm(lfmPage + 1)}
                        disabled={
                          lfmPage * lfmPerPage >= (lfmPreview.total || 0)
                        }
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>
                    No Last.fm preview yet — enter username and date range then
                    Fetch.
                  </p>
                )}
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
                <div className={styles.date}>
                  {s.first_listen_date
                    ? formatISOToDisplay(s.first_listen_date)
                    : "(no date)"}
                </div>

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
                    <input
                      defaultValue={songDateDraft || s.first_listen_date || ""}
                      ref={songDateRef}
                      placeholder="Date (DD/MM/YYYY or YYYY-MM-DD)"
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
                    setSongDateDraft(s.first_listen_date || "");
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
