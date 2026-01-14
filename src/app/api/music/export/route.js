import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();
    const from = body.from || null; // expected YYYY-MM-DD or null
    const to = body.to || null;

    if (!from && !to) {
      return NextResponse.json(
        { error: "Provide at least one date: from or to (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

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

    // Build query
    let query = db
      .from("songs")
      .select("first_listen_date,title,artist")
      .not("first_listen_date", "is", null)
      .order("first_listen_date", { ascending: true })
      .order("sequence", { ascending: true });

    if (from && to) {
      query = query.gte("first_listen_date", from).lte("first_listen_date", to);
    } else if (from) {
      query = query.eq("first_listen_date", from);
    } else if (to) {
      query = query.eq("first_listen_date", to);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Export query failed", error);
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }

    // Format CSV: Date (DD/MM/YYYY), Title, Artist
    const escapeCell = (s) => {
      if (s == null) return "";
      const str = String(s);
      const needsQuote = /[",\n]/.test(str);
      const escaped = str.replace(/"/g, '""');
      return needsQuote ? `"${escaped}"` : escaped;
    };

    const formatDate = (iso) => {
      if (!iso) return "";
      const d = new Date(iso + "T00:00:00Z");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const header = ["Date", "Title", "Artist"].join(",") + "\n";
    const rows = (data || []).map((r) => {
      const date = formatDate(r.first_listen_date);
      return [escapeCell(date), escapeCell(r.title), escapeCell(r.artist)].join(
        ","
      );
    });

    const csv = header + rows.join("\n") + "\n";

    const filenameFrom = from ? from : "all";
    const filenameTo = to ? to : "all";
    const filename = `songs_${filenameFrom}_${filenameTo}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export route failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
