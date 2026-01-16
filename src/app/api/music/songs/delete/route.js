import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();
    const id = body && body.id ? body.id : null;
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });

    // require auth token so we can validate permissions via RLS
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // client with user's token to verify permission via RLS
    const userDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Ensure the current user can see the song (simple permission check via RLS)
    const { data: songData, error: fetchErr } = await userDb
      .from("songs")
      .select("id")
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (fetchErr) {
      console.error("permission check failed", fetchErr);
      return NextResponse.json(
        { error: "Permission check failed" },
        { status: 500 }
      );
    }
    if (!songData) {
      return NextResponse.json(
        { error: "Not found or permission denied" },
        { status: 404 }
      );
    }

    // Use service role client to clear references and delete the song (avoid FK failures)
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      // Try best-effort using the user's token (may fail due to RLS)
      try {
        // Attempt to clear import_rows refs using user permissions
        const { error: clearByUserErr } = await userDb
          .from("import_rows")
          .update({ matched_song_id: null })
          .eq("matched_song_id", id);
        if (!clearByUserErr) {
          // Attempt to delete the song using user permissions
          const { error: delByUserErr } = await userDb
            .from("songs")
            .delete()
            .eq("id", id);
          if (!delByUserErr) {
            return NextResponse.json(
              { success: true, note: "Deleted using user permissions" },
              { status: 200 }
            );
          } else {
            console.error("user failed deleting song", delByUserErr);
            return NextResponse.json(
              { error: "Permission denied deleting song (user token)" },
              { status: 403 }
            );
          }
        }
      } catch (e) {
        console.error("user-scoped delete attempt failed", e);
      }

      // If we get here, we couldn't perform the operation with the user's token.
      // Count import_rows references and return actionable guidance so the user can run SQL in Supabase SQL editor.
      const {
        data: _,
        error: countErr,
        count,
      } = await userDb
        .from("import_rows")
        .select("id", { count: "exact", head: true })
        .eq("matched_song_id", id);
      if (countErr) {
        console.error(
          "failed counting import_rows refs without service key",
          countErr
        );
        return NextResponse.json(
          { error: "Server misconfigured: missing service role key" },
          { status: 500 }
        );
      }
      const guidanceSql = `-- Run this in the Supabase SQL editor as an admin or with the service role key\nUPDATE import_rows SET matched_song_id = NULL WHERE matched_song_id = '${id}';\nDELETE FROM songs WHERE id = '${id}';`;
      return NextResponse.json(
        {
          error: "Server misconfigured: missing service role key",
          guidance: {
            import_rows_ref_count: count ?? 0,
            sql: guidanceSql,
            note: "Set SUPABASE_SERVICE_ROLE_KEY in server environment to allow automatic safe deletion, or run the SQL above in the Supabase SQL editor.",
          },
        },
        { status: 500 }
      );
    }
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // Clear import_rows.matched_song_id references
    const { error: clearErr } = await svc
      .from("import_rows")
      .update({ matched_song_id: null })
      .eq("matched_song_id", id);
    if (clearErr) {
      console.error("failed clearing import_rows refs", clearErr);
      return NextResponse.json(
        { error: "Failed clearing import rows references" },
        { status: 500 }
      );
    }

    // Now delete the song
    const { error: delErr } = await svc.from("songs").delete().eq("id", id);
    if (delErr) {
      console.error("failed deleting song", delErr);
      return NextResponse.json(
        { error: "Failed deleting song" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("delete song failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
