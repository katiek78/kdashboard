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

    // Try RPC first
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
