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
