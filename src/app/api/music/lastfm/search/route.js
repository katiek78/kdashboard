import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeString, similarityScore } from "@/lib/musicImportUtils";

// Search a user's Last.fm recent tracks history (server-side) and return tracks
// matching a query (by title and/or artist). This iterates pages server-side so
// it can operate on the full history for a date range. Safety caps prevent
// runaway fetches.

const MAX_PAGES = 200;
const PER_PAGE = 200;
const MAX_RESULTS = 1000; // absolute cap returned

function matches({
  qNorm,
  qRaw,
  type = "both",
  matchType = "substring",
  title,
  artist,
  thresh = 0.68,
}) {
  const t = String(title || "");
  const a = String(artist || "");
  if (matchType === "exact") {
    if (type === "title") return normalizeString(t) === qNorm;
    if (type === "artist") return normalizeString(a) === qNorm;
    return normalizeString(t) === qNorm || normalizeString(a) === qNorm;
  }

  if (matchType === "substring") {
    const q = qRaw.toLowerCase();
    if (type === "title") return t.toLowerCase().includes(q);
    if (type === "artist") return a.toLowerCase().includes(q);
    return t.toLowerCase().includes(q) || a.toLowerCase().includes(q);
  }

  // fuzzy
  const tNorm = normalizeString(t);
  const aNorm = normalizeString(a);
  if (type === "title") return similarityScore(qNorm, tNorm) >= thresh;
  if (type === "artist") return similarityScore(qNorm, aNorm) >= thresh;
  return (
    similarityScore(qNorm, tNorm) >= thresh ||
    similarityScore(qNorm, aNorm) >= thresh
  );
}

// helper: sleep and fetch with retries (exponential backoff, handle 429 Retry-After and transient 5xx)
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchWithRetries(
  url,
  opts = {},
  { retries = 3, backoff = 300 } = {}
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal && opts.signal.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }
    try {
      const r = await fetch(url, opts);
      if (r.ok) return { ok: true, r };
      const txt = await r.text().catch(() => "");
      const status = r.status;
      if (status === 429) {
        const ra = r.headers.get("Retry-After");
        const wait = ra
          ? parseInt(ra, 10) * 1000
          : backoff * Math.pow(2, attempt);
        if (attempt < retries) {
          await sleep(wait + Math.floor(Math.random() * 200));
          continue;
        }
        return { ok: false, status, text: txt };
      }
      if (status >= 500 && status < 600) {
        if (attempt < retries) {
          await sleep(
            backoff * Math.pow(2, attempt) + Math.floor(Math.random() * 200)
          );
          continue;
        }
        return { ok: false, status, text: txt };
      }
      return { ok: false, status, text: txt };
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (attempt < retries) {
        await sleep(
          backoff * Math.pow(2, attempt) + Math.floor(Math.random() * 200)
        );
        continue;
      }
      return { ok: false, error: String(e) };
    }
  }
  return { ok: false, error: "Unknown fetch error" };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const username = body.username || null;
    const query = body.query || null;
    if (!username || !query)
      return NextResponse.json(
        { error: "username and query required" },
        { status: 400 }
      );

    const type = body.type || "both"; // title|artist|both
    const matchType = body.matchType || "substring"; // substring|exact|fuzzy
    const thresh = typeof body.threshold === "number" ? body.threshold : 0.68;
    const from = body.from || null;
    const to = body.to || null;
    const page = Number(body.page || 1);
    const limit = Math.min(Number(body.limit || 200), PER_PAGE);

    const LASTFM_KEY =
      process.env.LASTFM_API_KEY || process.env.NEXT_PUBLIC_LASTFM_KEY;
    const ua = process.env.NEXT_PUBLIC_APP_NAME
      ? `${process.env.NEXT_PUBLIC_APP_NAME} lastfm-search`
      : "kdashboard lastfm-search";

    if (!LASTFM_KEY)
      return NextResponse.json(
        { error: "Missing Last.fm API key on server" },
        { status: 500 }
      );

    const qRaw = String(query || "");
    const qNorm = normalizeString(qRaw);

    let matchesFound = [];
    let failedPages = [];
    let consecutiveFailures = 0;

    let p = page;
    let totalPages = 1;
    let pagesVisited = 0;

    while (
      p <= totalPages &&
      pagesVisited < MAX_PAGES &&
      matchesFound.length < MAX_RESULTS
    ) {
      const url = new URL("https://ws.audioscrobbler.com/2.0/");
      url.searchParams.set("method", "user.getrecenttracks");
      url.searchParams.set("user", username);
      url.searchParams.set("api_key", LASTFM_KEY);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("page", String(p));
      if (from) url.searchParams.set("from", String(from));
      if (to) url.searchParams.set("to", String(to));

      const r = await fetch(url.toString(), { headers: { "User-Agent": ua } });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        // If single-page requested, return error to client (keep previous behavior)
        if (page > 1) {
          return NextResponse.json(
            { error: `Last.fm fetch failed page ${p}: ${r.status} ${txt}` },
            { status: 502 }
          );
        }

        // Otherwise, record the failed page and continue to next page (tolerate occasional transient errors)
        failedPages.push({ page: p, status: r.status, text: txt });
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          // stop if too many consecutive failures
          console.error(
            "Too many consecutive Last.fm page failures, aborting further pages",
            failedPages
          );
          break;
        }
        pagesVisited++;
        p++;
        // backoff a bit before continuing
        await new Promise((res) => setTimeout(res, 240));
        continue;
      }

      // reset consecutive failures count on success
      consecutiveFailures = 0;

      const payload = await r.json();
      const raw = payload?.recenttracks?.track || [];
      const attr = payload?.recenttracks?.["@attr"] || {};
      totalPages = Number(attr.totalPages || 1);

      // Filter tracks that have dates and that match our query
      for (const t of raw) {
        const dateObj = t.date || null;
        const unix = dateObj && dateObj.uts ? Number(dateObj.uts) : null;
        const iso = unix
          ? new Date(unix * 1000).toISOString().split("T")[0]
          : null;
        if (!iso) continue; // skip undated

        const title = t.name || "";
        const artist = (t.artist && (t.artist["#text"] || t.artist.name)) || "";

        if (matches({ qNorm, qRaw, type, matchType, title, artist, thresh })) {
          matchesFound.push({ title, artist, unix, iso, raw: t });
          if (matchesFound.length >= MAX_RESULTS) break;
        }
      }

      pagesVisited++;
      p++;

      // small polite delay to avoid Last.fm bursts
      await new Promise((res) => setTimeout(res, 120));

      // If page was user-requested (page>1), stop after that single page; otherwise fetch further pages until exhaustion or cap.
      if (page > 1) break;
    }

    const resp = {
      success: true,
      username,
      query,
      type,
      matchType,
      results: matchesFound.slice(
        0,
        Math.min(matchesFound.length, body.maxResults || 200)
      ),
      totalFound: matchesFound.length,
    };
    if (failedPages.length) resp.warnings = { failedPages };
    return NextResponse.json(resp);
  } catch (err) {
    console.error("lastfm search failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
