import { parseDateToISO } from "@/lib/dateUtils";

export async function resequenceSongsUsingSQL(db) {
  try {
    // Fetch all song ids ordered by current sequence ascending
    const { data: rows, error: fetchErr } = await db
      .from("songs")
      .select("id, sequence")
      .order("sequence", { ascending: true });
    if (fetchErr) {
      console.error("resequence fallback: failed fetching songs", fetchErr);
      return null;
    }

    let i = 0;
    for (const r of rows || []) {
      i += 1;
      // Only update if sequence differs (minimize writes)
      if (r.sequence !== i) {
        const { error: updErr } = await db
          .from("songs")
          .update({ sequence: i })
          .eq("id", r.id);
        if (updErr)
          console.error("resequence fallback: update failed for", r.id, updErr);
      }
    }
    return i;
  } catch (e) {
    console.error("resequence fallback exception", e);
    return null;
  }
}

export async function resequenceSongsPreserveUndated(db) {
  try {
    const { data: rows, error: fetchErr } = await db
      .from("songs")
      .select("id,sequence,first_listen_date")
      .order("sequence", { ascending: true });
    if (fetchErr) {
      console.error("resequence preserve: failed fetching songs", fetchErr);
      return null;
    }

    // Build items array from current ordering
    const seqNumbers = (rows || []).map((r) => r.sequence);
    const items = (rows || []).map((r, idx) => ({
      id: r.id,
      sequence: r.sequence,
      date: r.first_listen_date || null,
      origIndex: idx,
    }));

    // For each undated item, determine the next dated song's date (scan forward). If none found, treat as very large date
    for (let i = 0; i < items.length; i++) {
      if (!items[i].date) {
        let found = null;
        for (let j = i + 1; j < items.length; j++) {
          if (items[j].date) {
            found = items[j].date;
            break;
          }
        }
        items[i].sortDate = found || "9999-12-31"; // undated with no later dated -> treated as latest
        items[i].isUndated = true;
      } else {
        items[i].sortDate = items[i].date;
        items[i].isUndated = false;
      }
    }

    // Sort by (sortDate asc, undated before dated for same sortDate, origIndex for stability)
    const sorted = items.slice().sort((a, b) => {
      if (a.sortDate < b.sortDate) return -1;
      if (a.sortDate > b.sortDate) return 1;
      if (a.isUndated !== b.isUndated) return a.isUndated ? -1 : 1;
      return a.origIndex - b.origIndex;
    });

    // Use existing sequence numbers (sorted) as the target slots so undated blocks can shift but keep their internal order
    const availableSeqNumbers = seqNumbers.slice().sort((a, b) => a - b);

    // Map sorted items to target slots and compute necessary updates
    const updates = [];
    for (let i = 0; i < sorted.length; i++) {
      const targetSeq = availableSeqNumbers[i];
      const it = sorted[i];
      if (targetSeq && it.sequence !== targetSeq) {
        updates.push({ id: it.id, from: it.sequence, to: targetSeq });
      }
    }

    if (updates.length === 0) return 0;

    // To avoid unique conflicts, first move updated rows to very high temporary slots
    const maxSeq = Math.max(...seqNumbers, rows.length);
    for (const u of updates) {
      const { error: tmpErr } = await db
        .from("songs")
        .update({ sequence: u.to + maxSeq + 10 })
        .eq("id", u.id);
      if (tmpErr)
        console.error("resequence preserve: tmp update failed", u.id, tmpErr);
    }

    // Then move to final target slots
    let changed = 0;
    for (const u of updates) {
      const { error: finalErr } = await db
        .from("songs")
        .update({ sequence: u.to })
        .eq("id", u.id);
      if (finalErr)
        console.error(
          "resequence preserve: final update failed",
          u.id,
          finalErr
        );
      else changed++;
    }

    return changed;
  } catch (e) {
    console.error("resequence preserve exception", e);
    return null;
  }
}

export async function resequenceSongsPreserveUndatedV2(
  db,
  options = { apply: true, slice: null }
) {
  // New grouping algorithm: undated blocks are treated as atomic and placed before the next dated group
  try {
    // Support optional slice for focused diagnose runs (e.g., { slice: { startSequence: 2400, endSequence: 2510 } })
    let q = db
      .from("songs")
      .select("id,sequence,first_listen_date")
      .order("sequence", { ascending: true });
    if (options && options.slice) {
      const s = options.slice;
      if (typeof s.startSequence === "number")
        q = q.gte("sequence", Number(s.startSequence));
      if (typeof s.endSequence === "number")
        q = q.lte("sequence", Number(s.endSequence));
    }

    const { data: rows, error: fetchErr } = await q;
    if (fetchErr) {
      console.error("resequence preserve v2: failed fetching songs", fetchErr);
      return { error: String(fetchErr) };
    }

    const seqNumbers = (rows || []).map((r) => r.sequence);

    // Normalize dates using parseDateToISO and collect parse errors
    const parseErrors = [];
    const items = (rows || []).map((r, idx) => {
      const raw = r.first_listen_date || null;
      const normalized = raw ? parseDateToISO(raw) : null;
      if (raw && !normalized) {
        parseErrors.push({ id: r.id, raw });
      }
      return {
        id: r.id,
        sequence: r.sequence,
        date: normalized, // normalized ISO or null
        rawDate: raw,
        origIndex: idx,
      };
    });

    // Build undated blocks and dated map using normalized dates
    const undatedBlocks = [];
    const datedByDate = new Map();
    let i = 0;
    while (i < items.length) {
      if (!items[i].date) {
        const start = i;
        const block = [];
        while (i < items.length && !items[i].date) {
          block.push(items[i]);
          i++;
        }
        const nextDate = i < items.length ? items[i].date : "9999-12-31";
        undatedBlocks.push({ items: block, key: nextDate, origIndex: start });
      } else {
        const d = items[i].date;
        if (!datedByDate.has(d)) datedByDate.set(d, []);
        datedByDate.get(d).push(items[i]);
        i++;
      }
    }

    // Sort date keys in chronological order (ISO strings sort correctly)
    const dateKeys = Array.from(datedByDate.keys()).sort();
    if (
      undatedBlocks.some((b) => b.key === "9999-12-31") &&
      !dateKeys.includes("9999-12-31")
    )
      dateKeys.push("9999-12-31");

    const finalList = [];
    for (const key of dateKeys) {
      const blocks = undatedBlocks
        .filter((b) => b.key === key)
        .sort((a, b) => a.origIndex - b.origIndex);
      for (const b of blocks) for (const it of b.items) finalList.push(it);
      const dated = datedByDate.get(key) || [];
      for (const it of dated) finalList.push(it);
    }

    const remaining = undatedBlocks
      .filter((b) => !dateKeys.includes(b.key))
      .sort((a, b) => a.origIndex - b.origIndex);
    for (const b of remaining) for (const it of b.items) finalList.push(it);

    if (finalList.length !== rows.length) {
      console.warn("resequence preserve v2: length mismatch, aborting");
      return { error: "length_mismatch" };
    }

    const availableSeqNumbers = seqNumbers.slice().sort((a, b) => a - b);
    const updates = [];
    for (let k = 0; k < finalList.length; k++) {
      const target = availableSeqNumbers[k];
      const it = finalList[k];
      if (target && it.sequence !== target)
        updates.push({
          id: it.id,
          from: it.sequence,
          to: target,
          index: k,
          date: it.date,
          rawDate: it.rawDate,
          origIndex: it.origIndex,
        });
    }

    // detect inversions (for diagnostics): any pair where earlier in finalList has a later date than a later one
    const inversions = [];
    for (let a = 0; a < finalList.length; a++) {
      for (let b = a + 1; b < finalList.length; b++) {
        const da = finalList[a].date || "9999-12-31";
        const db = finalList[b].date || "9999-12-31";
        if (da > db)
          inversions.push({
            left: finalList[a],
            right: finalList[b],
            leftIdx: a,
            rightIdx: b,
          });
      }
    }

    if (!options.apply) {
      return { updates, inversions, finalList, parseErrors };
    }

    if (updates.length === 0) return { updates: [], inversions, parseErrors };
    const maxSeq = Math.max(...seqNumbers, rows.length);
    for (const u of updates) {
      const { error: tmpErr } = await db
        .from("songs")
        .update({ sequence: u.to + maxSeq + 10 })
        .eq("id", u.id);
      if (tmpErr)
        console.error(
          "resequence preserve v2: tmp update failed",
          u.id,
          tmpErr
        );
    }

    let changed = 0;
    for (const u of updates) {
      const { error: finalErr } = await db
        .from("songs")
        .update({ sequence: u.to })
        .eq("id", u.id);
      if (finalErr)
        console.error(
          "resequence preserve v2: final update failed",
          u.id,
          finalErr
        );
      else changed++;
    }

    return { changed, inversions, updates, parseErrors };
  } catch (e) {
    console.error("resequence preserve v2 exception", e);
    return { error: String(e) };
  }
}
