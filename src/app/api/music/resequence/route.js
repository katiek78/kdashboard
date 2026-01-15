import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
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

    const body = await req.json().catch(() => ({}));
    const preserveUndated =
      body && typeof body.preserveUndated !== "undefined"
        ? !!body.preserveUndated
        : true;

    if (preserveUndated) {
      // prefer server-side JS implementation that preserves undated songs in-place
      try {
        const diagnose = !!body.diagnose;
        const { resequenceSongsPreserveUndatedV2 } = await import(
          "@/lib/resequenceSongs"
        );
        const opts = { apply: !diagnose };
        if (
          typeof body.sequenceFrom === "number" ||
          typeof body.sequenceTo === "number"
        ) {
          opts.slice = {};
          if (typeof body.sequenceFrom === "number")
            opts.slice.startSequence = Number(body.sequenceFrom);
          if (typeof body.sequenceTo === "number")
            opts.slice.endSequence = Number(body.sequenceTo);
        }
        const r = await resequenceSongsPreserveUndatedV2(db, opts);
        // If there are parse errors, log a summary so we can see malformed date formats
        if (r && r.parseErrors && r.parseErrors.length) {
          console.warn(
            `Resequence v2: detected ${r.parseErrors.length} unparseable dates (showing up to 10)`,
            r.parseErrors.slice(0, 10)
          );
        }
        if (diagnose) {
          return NextResponse.json({
            success: true,
            version: "v2",
            diagnose: true,
            ...r,
          });
        }
        if (r && r.inversions && r.inversions.length) {
          console.warn(
            "Resequence v2 detected inversions after ordering:",
            r.inversions.slice(0, 10)
          );
        }
        console.log(
          `Resequence v2 completed: ${r && r.changed ? r.changed : 0} changes`
        );
        return NextResponse.json({
          success: true,
          resequenced: r && r.changed ? r.changed : 0,
          version: "v2",
        });
      } catch (e) {
        console.error("resequence preserve v2 failed", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
      }
    }

    // Otherwise, run the legacy full resequence (RPC if available, else fallback)
    try {
      const { data, error } = await db.rpc("resequence_songs");
      if (error) {
        // If RPC isn't present in schema cache (PGRST202), fall back to SQL implementation
        if (error && error.code === "PGRST202") {
          try {
            const { resequenceSongsUsingSQL } = await import(
              "@/lib/resequenceSongs"
            );
            const r = await resequenceSongsUsingSQL(db);
            return NextResponse.json({ success: true, resequenced: r || null });
          } catch (fe) {
            console.error("resequence fallback failed", fe);
            return NextResponse.json({ error: String(fe) }, { status: 500 });
          }
        }
        console.error("resequence_songs rpc error", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
      }

      // rpc returns integer (new max sequence) in data
      return NextResponse.json({ success: true, resequenced: data || null });
    } catch (e) {
      console.error("resequence call failed", e);
      try {
        const { resequenceSongsUsingSQL } = await import(
          "@/lib/resequenceSongs"
        );
        const r = await resequenceSongsUsingSQL(db);
        return NextResponse.json({ success: true, resequenced: r || null });
      } catch (fe) {
        console.error("resequence fallback failed after exception", fe);
        return NextResponse.json({ error: String(fe) }, { status: 500 });
      }
    }
  } catch (err) {
    console.error("resequence endpoint failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
