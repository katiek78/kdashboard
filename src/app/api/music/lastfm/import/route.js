import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeString, similarityScore } from "@/lib/musicImportUtils";
import { parseDateToISO } from "@/lib/dateUtils";

function compareISO(a, b) {
  // a and b are ISO-like 'YYYY-MM-DD' strings (or null). Returns -1 if a < b, 0 if equal, 1 if a > b.
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  // Try to normalize using parseDateToISO first (ensures DD/MM is treated day-first and MM/DD is never used)
  const normA = parseDateToISO(a) || a;
  const normB = parseDateToISO(b) || b;
  const ma = normA.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mb = normB.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ma && mb) {
    // continue to numeric comparison below
  } else {
    // fallback: Date.parse compare (only for non-standard inputs); prefer normalized values when available
    const ta = Date.parse(normA);
    const tb = Date.parse(normB);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return -1;
    if (isNaN(tb)) return 1;
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return 0;
  }
  const ay = Number(ma[1]),
    am = Number(ma[2]),
    ad = Number(ma[3]);
  const by = Number(mb[1]),
    bm = Number(mb[2]),
    bd = Number(mb[3]);
  if (ay !== by) return ay < by ? -1 : 1;
  if (am !== bm) return am < bm ? -1 : 1;
  if (ad !== bd) return ad < bd ? -1 : 1;
  return 0;
}

export async function POST(req) {
  try {
    const body = await req.json();
    // Accept either a provided tracks array (from preview page) OR a username+from+to to fetch all pages server-side
    let tracks = Array.isArray(body.tracks) ? body.tracks : [];
    const username = body.username || null;
    const from = body.from || null;
    const to = body.to || null;

    if ((!tracks || tracks.length === 0) && !username) {
      return NextResponse.json(
        { error: "No tracks provided and no username given" },
        { status: 400 }
      );
    }

    const LASTFM_KEY =
      process.env.LASTFM_API_KEY || process.env.NEXT_PUBLIC_LASTFM_KEY;
    const ua = process.env.NEXT_PUBLIC_APP_NAME
      ? `${process.env.NEXT_PUBLIC_APP_NAME} lastfm-import`
      : "kdashboard lastfm-import";

    // If username provided and no tracks supplied, fetch all pages from Last.fm for the date range
    if ((!tracks || tracks.length === 0) && username) {
      if (!LASTFM_KEY)
        return NextResponse.json(
          { error: "Missing Last.fm API key on server" },
          { status: 500 }
        );
      const limit = 200; // fetch max per page
      let page = 1;
      let totalPages = 1;
      const fetched = [];
      const maxPages = 200; // safety cap
      while (page <= totalPages && page <= maxPages) {
        const url = new URL("https://ws.audioscrobbler.com/2.0/");
        url.searchParams.set("method", "user.getrecenttracks");
        url.searchParams.set("user", username);
        url.searchParams.set("api_key", LASTFM_KEY);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("page", String(page));
        if (from) url.searchParams.set("from", String(from));
        if (to) url.searchParams.set("to", String(to));

        const r = await fetch(url.toString(), {
          headers: { "User-Agent": ua },
        });
        if (!r.ok) {
          const txt = await r.text();
          return NextResponse.json(
            { error: `Last.fm fetch failed page ${page}: ${r.status} ${txt}` },
            { status: 502 }
          );
        }
        const payload = await r.json();
        const raw = payload?.recenttracks?.track || [];
        const attr = payload?.recenttracks?.["@attr"] || {};
        totalPages = Number(attr.totalPages || 1);

        for (const t of raw) {
          const title = t.name || "";
          const artist =
            (t.artist && (t.artist["#text"] || t.artist.name)) || "";
          const dateObj = t.date || null;
          const unix = dateObj && dateObj.uts ? Number(dateObj.uts) : null;
          const iso = unix
            ? new Date(unix * 1000).toISOString().split("T")[0]
            : null;
          if (!iso) continue; // skip undated
          fetched.push({ title, artist, isoDate: iso, unix });
        }

        page += 1;
        // small delay to be nice to Last.fm (and avoid bursts) - optional
        await new Promise((res) => setTimeout(res, 150));
      }

      // sort oldest -> newest
      fetched.sort((a, b) =>
        a.isoDate < b.isoDate ? -1 : a.isoDate > b.isoDate ? 1 : 0
      );
      tracks = fetched;
    }

    // require auth token so RLS will scope operations to this user
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

    // Filter & normalize tracks: only dated tracks (isoDate required)
    const good = tracks
      .map((t) => ({
        title: t.title || "",
        artist: t.artist || "",
        iso: t.isoDate || t.iso || null,
        unix: t.unix || null,
        normTitle: normalizeString(t.title || ""),
        normArtist: normalizeString(t.artist || ""),
      }))
      .filter((t) => t.iso);

    // sort oldest -> newest by unix if available, otherwise by iso
    good.sort((a, b) => {
      if (a.unix != null && b.unix != null) return a.unix - b.unix;
      if (a.unix != null) return -1;
      if (b.unix != null) return 1;
      return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0;
    });

    const dryRun = !!body.dryRun;

    // If dryRun is requested, simulate the import and return a plan summary without writing to DB
    if (dryRun) {
      // require auth token so we can check for existing songs under the user's RLS
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token)
        return NextResponse.json(
          { error: "Authentication required for dryRun" },
          { status: 401 }
        );

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const uniqueCount = new Set(
        good.map((g) => `${g.normTitle}|||${g.normArtist}`)
      ).size;
      const plan = {
        totalFetched: tracks.length,
        datedCount: good.length,
        uniqueCount,
        wouldCreate: 0,
        wouldUpdate: 0,
        wouldLink: 0,
        skipped: 0,
      };

      // Pre-populate existing songs map for lookups (keyed by normTitle|||normArtist)
      const existing = {};
      for (const g of good) {
        const key = `${g.normTitle}|||${g.normArtist}`;
        if (existing[key]) continue;
        try {
          let exact = null;
          const { data: exactData } = await db
            .from("songs")
            .select(
              "id,first_listen_date,first_listen_ts,title,artist,sequence"
            )
            .eq("norm_title", g.normTitle)
            .eq("norm_artist", g.normArtist)
            .limit(1)
            .maybeSingle();
          if (exactData) exact = exactData;

          // Fallback: try case-insensitive exact match on title/artist when norm fields not set or differ
          if (!exact && g.title && g.artist) {
            try {
              const { data: ilikeData } = await db
                .from("songs")
                .select("id,first_listen_date,title,artist,sequence")
                .ilike("title", g.title)
                .ilike("artist", g.artist)
                .limit(1)
                .maybeSingle();
              if (ilikeData) exact = ilikeData;
            } catch (e) {
              console.error("Dry-run ilike lookup error", e);
            }
          }

          if (exact) existing[key] = exact;
        } catch (e) {
          console.error("Dry-run lookup error", e);
        }
      }

      // Build per-unique-track decisions in order of first occurrence
      const decisions = [];
      const seen = { ...existing };
      const uniqueMap = {};
      const firstOrder = [];
      for (const g of good) {
        const key = `${g.normTitle}|||${g.normArtist}`;
        if (!uniqueMap[key]) {
          uniqueMap[key] = g;
          firstOrder.push(key);
        }
      }

      // Track reserved insertion positions to ensure multiple creates/updates don't claim the same position.
      const reservedPositions = new Set();
      const reservePosition = (desired) => {
        let p = typeof desired === "number" && desired > 0 ? desired : 1;
        while (reservedPositions.has(p)) p++;
        reservedPositions.add(p);
        return p;
      };

      let orderCounter = 1;
      for (const key of firstOrder) {
        const g = uniqueMap[key];
        const parsed = parseDateToISO(g.iso);
        if (!parsed) {
          plan.skipped++;
          decisions.push({
            action: "skip",
            title: g.title,
            artist: g.artist,
            iso: g.iso,
            incomingUnix: g.unix || null,
            incomingTsIso: g.unix
              ? new Date(g.unix * 1000).toISOString()
              : null,
            order: orderCounter++,
          });
          continue;
        }

        const prior = seen[key];
        if (prior) {
          const priorDate = prior.first_listen_date || null;
          const priorTs = prior.first_listen_ts || null;

          if (priorDate) {
            // Prefer timestamp comparison when both sides have times
            if (g.unix != null && priorTs) {
              const priorUnix = Math.floor(Date.parse(priorTs) / 1000);
              if (g.unix < priorUnix) {
                plan.wouldUpdate++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "update",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: priorDate || null,
                  existingFirstListenTs: priorTs || null,
                  existingSequence: prior.sequence || null,
                  incomingUnix: g.unix,
                  wouldUpdateTo: parsed,
                  wouldUpdateToTs: new Date(g.unix * 1000).toISOString(),
                  order: orderCounter++,
                });
                seen[key] = { ...prior, first_listen_date: parsed };
              } else {
                plan.wouldLink++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "link",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: priorDate || null,
                  existingFirstListenTs: priorTs || null,
                  existingSequence: prior.sequence || null,
                  incomingUnix: g.unix,
                  order: orderCounter++,
                });
              }
            } else {
              // Existing song has a date: compare dates as before
              if (compareISO(parsed, priorDate) < 0) {
                plan.wouldUpdate++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "update",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: priorDate || null,
                  existingSequence: prior.sequence || null,
                  incomingUnix: g.unix || null,
                  wouldUpdateTo: parsed,
                  wouldUpdateToTs: g.unix
                    ? new Date(g.unix * 1000).toISOString()
                    : null,
                  order: orderCounter++,
                });
                seen[key] = { ...prior, first_listen_date: parsed };
              } else {
                plan.wouldLink++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "link",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: priorDate || null,
                  existingSequence: prior.sequence || null,
                  incomingUnix: g.unix || null,
                  order: orderCounter++,
                });
              }
            }
          } else {
            // Existing song has no date; infer using sequence position in DB
            try {
              // find last dated song <= parsed and use its sequence; if none, use max sequence (append)
              const { data: lastDated } = await db
                .from("songs")
                .select("sequence")
                .lte("first_listen_date", parsed)
                .not("first_listen_date", "is", null)
                .order("first_listen_date", { ascending: false })
                .order("sequence", { ascending: false })
                .limit(1);
              let lastSeq =
                lastDated && lastDated.length ? lastDated[0].sequence : null;
              if (lastSeq == null) {
                const { data: maxSeqRows } = await db
                  .from("songs")
                  .select("sequence")
                  .order("sequence", { ascending: false })
                  .limit(1);
                lastSeq =
                  maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
              }

              const rawPos = lastSeq + 1;
              const existingSeq =
                typeof prior.sequence === "number" ? prior.sequence : null;

              // if existing sequence is <= lastSeq, it is earlier (link), else update
              if (existingSeq !== null && existingSeq <= lastSeq) {
                plan.wouldLink++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "link",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: null,
                  existingSequence: existingSeq,
                  order: orderCounter++,
                });
              } else {
                const insertionPosition = reservePosition(rawPos);
                plan.wouldUpdate++;
                decisions.push({
                  key: `${g.normTitle}|||${g.normArtist}`,
                  action: "update",
                  title: g.title,
                  artist: g.artist,
                  iso: g.iso,
                  existingId: prior.id || null,
                  existingFirstListenDate: null,
                  existingSequence: prior.sequence || null,
                  wouldUpdateTo: parsed,
                  insertionPosition,
                  order: orderCounter++,
                });
                seen[key] = { ...prior, first_listen_date: parsed };
              }
            } catch (e) {
              console.error("Dry-run position lookup error", e);
              // fallback to link
              plan.wouldLink++;
              decisions.push({
                action: "link",
                title: g.title,
                artist: g.artist,
                iso: g.iso,
                existingId: prior.id || null,
                existingFirstListenDate: null,
                existingSequence: prior.sequence || null,
                order: orderCounter++,
              });
            }
          }
        } else {
          // compute insertion position for created entry
          let insertionPosition = null;
          try {
            // find last dated song <= parsed and use its sequence
            const { data: lastDated } = await db
              .from("songs")
              .select("sequence")
              .lte("first_listen_date", parsed)
              .not("first_listen_date", "is", null)
              .order("first_listen_date", { ascending: false })
              .order("sequence", { ascending: false })
              .limit(1);
            let lastSeq =
              lastDated && lastDated.length ? lastDated[0].sequence : null;
            if (lastSeq == null) {
              const { data: maxSeqRows } = await db
                .from("songs")
                .select("sequence")
                .order("sequence", { ascending: false })
                .limit(1);
              lastSeq =
                maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
            }
            const rawPos = lastSeq + 1;
            insertionPosition = reservePosition(rawPos);
          } catch (e) {
            console.error("Dry-run insertion position error", e);
          }

          // Before creating, check for suggestions.
          // Prefer exact normalized title matches (title-only match) to surface a link option when titles align.
          let suggestion = null;
          try {
            // Try exact norm_title matches first (title-only candidates), with variants helper
            const { findExactMatchVariants } = await import(
              "@/lib/musicImportUtils"
            );
            try {
              // attempt variant-aware match where artist matches
              const titleExact = await findExactMatchVariants(
                g.normArtist,
                g.normTitle,
                db,
                g.artist,
                g.title
              );
              if (titleExact) {
                suggestion = {
                  id: titleExact.id,
                  title: titleExact.title,
                  artist: titleExact.artist,
                  score: 0.995,
                  matchType: "titleOnly",
                };
              }
            } catch (e) {
              console.error("title-only variants lookup error", e);
            }

            if (!suggestion) {
              // fallback to fuzzy suggestions
              const token =
                g.normTitle.split(" ")[0] || g.normArtist.split(" ")[0] || "";
              const tokenLike = `%${token}%`;
              const { data: candidates = [] } = await db
                .from("songs")
                .select(
                  "id,title,artist,sequence,first_listen_date,norm_title,norm_artist"
                )
                .or(
                  `norm_title.ilike.${tokenLike},norm_artist.ilike.${tokenLike}`
                )
                .limit(50);

              let best = null;
              for (const c of candidates) {
                const titleScore = similarityScore(
                  g.normTitle,
                  c.norm_title || ""
                );
                const artistScore = similarityScore(
                  g.normArtist,
                  c.norm_artist || ""
                );
                const score = titleScore * 0.65 + artistScore * 0.35;
                if (!best || score > best.score) best = { score, candidate: c };
              }
              if (best && best.score >= 0.68) {
                suggestion = {
                  id: best.candidate.id,
                  title: best.candidate.title,
                  artist: best.candidate.artist,
                  score: Number(best.score.toFixed(3)),
                  matchType: "fuzzy",
                };
              }
            }
          } catch (e) {
            console.error("Dry-run suggestion lookup error", e);
          }

          plan.wouldCreate++;
          const decision = {
            key: `${g.normTitle}|||${g.normArtist}`,
            action: "create",
            title: g.title,
            artist: g.artist,
            iso: g.iso,
            insertionPosition,
            incomingUnix: g.unix || null,
            incomingTsIso: g.unix
              ? new Date(g.unix * 1000).toISOString()
              : null,
            order: orderCounter++,
          };
          if (suggestion) decision.suggestion = suggestion;
          decisions.push(decision);

          // simulate creation
          seen[key] = { created: true, first_listen_date: parsed };
        }
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        plan,
        decisions,
        sample: good.slice(0, 15),
      });
    }

    const overrides = body.overrides || {};
    const debug = !!body.debug;
    const results = { created: [], updated: [], linked: [], skipped: 0 };
    const decisions = debug ? [] : null;

    for (const t of good) {
      const key = `${t.normTitle}|||${t.normArtist}`;
      const parsed = parseDateToISO(t.iso);
      const incomingTsIso = t.unix
        ? new Date(t.unix * 1000).toISOString()
        : null;
      if (!parsed) {
        // skip if somehow invalid
        results.skipped++;
        if (debug)
          decisions.push({
            key,
            action: "skip",
            title: t.title,
            artist: t.artist,
            iso: t.iso,
            incomingUnix: t.unix || null,
            incomingTsIso,
          });
        continue;
      }

      // check user overrides for this unique key
      const override = overrides[key] || null;

      // try exact match (unless override forces create)
      let exact = null;
      if (!override || override.action !== "create") {
        if (override && override.action === "link" && override.existingId) {
          // use provided existing id as the exact match target
          const { data: byId } = await db
            .from("songs")
            .select(
              "id,title,artist,sequence,first_listen_date,first_listen_ts"
            )
            .eq("id", override.existingId)
            .limit(1)
            .maybeSingle();
          exact = byId || null;
        } else {
          const { data } = await db
            .from("songs")
            .select(
              "id,title,artist,sequence,first_listen_date,first_listen_ts"
            )
            .eq("norm_title", t.normTitle)
            .eq("norm_artist", t.normArtist)
            .limit(1)
            .maybeSingle();
          exact = data || null;

          // Fallback: if no normalized exact match, attempt variant/ilike lookups
          if (!exact && t.title && t.artist) {
            try {
              const { findExactMatchVariants } = await import(
                "@/lib/musicImportUtils"
              );
              const variant = await findExactMatchVariants(
                t.normArtist,
                t.normTitle,
                db,
                t.artist,
                t.title
              );
              if (variant) exact = variant;
            } catch (e) {
              console.error("Exact match fallback error", e);
            }
          }
        }
      }

      if (exact) {
        // If existing record has a first_listen_date, compare dates as before
        if (exact.first_listen_date) {
          if (compareISO(parsed, exact.first_listen_date) < 0) {
            try {
              // determine insertion position: find the first song whose date is > parsed and insert before it
              let position = null;
              try {
                const { data: firstLater } = await db
                  .from("songs")
                  .select("sequence")
                  .gt("first_listen_date", parsed)
                  .not("first_listen_date", "is", null)
                  .order("sequence", { ascending: true })
                  .limit(1);
                if (firstLater && firstLater.length)
                  position = firstLater[0].sequence;
              } catch (e) {
                console.error("Failed finding firstLater position", e);
              }

              // if no later-dated song found, append after current max
              if (position == null) {
                const { data: maxRows } = await db
                  .from("songs")
                  .select("sequence")
                  .order("sequence", { ascending: false })
                  .limit(1);
                position =
                  maxRows && maxRows.length ? maxRows[0].sequence + 1 : 1;
              }

              const existingSeq =
                typeof exact.sequence === "number" ? exact.sequence : null;
              if (existingSeq !== null && existingSeq > position) {
                // move rows in [position, existingSeq-1] up by 1
                const { data: rowsToShift } = await db
                  .from("songs")
                  .select("id,sequence")
                  .gte("sequence", position)
                  .lt("sequence", existingSeq)
                  .order("sequence", { ascending: false });
                if (rowsToShift && rowsToShift.length) {
                  for (const row of rowsToShift) {
                    const { error: shiftErr } = await db
                      .from("songs")
                      .update({ sequence: row.sequence + 1 })
                      .eq("id", row.id);
                    if (shiftErr)
                      console.error(
                        "Failed shifting sequence for",
                        row.id,
                        shiftErr
                      );
                  }
                }

                const updatePayload = {
                  first_listen_date: parsed,
                  sequence: position,
                };
                if (incomingTsIso)
                  updatePayload.first_listen_ts = incomingTsIso;
                const { error: updErr } = await db
                  .from("songs")
                  .update(updatePayload)
                  .eq("id", exact.id);
                if (updErr)
                  console.error(
                    "Failed moving existing song date/update",
                    updErr
                  );
                else {
                  results.updated.push({
                    id: exact.id,
                    title: exact.title,
                    artist: exact.artist,
                    old: exact.first_listen_date,
                    new: parsed,
                  });
                  if (debug)
                    decisions.push({
                      key,
                      action: "update",
                      title: exact.title,
                      artist: exact.artist,
                      iso: parsed,
                      existingId: exact.id,
                      existingSequence: exact.sequence,
                      position,
                    });
                }
              } else {
                const { error: updErr } = await db
                  .from("songs")
                  .update({ first_listen_date: parsed })
                  .eq("id", exact.id);
                if (updErr) console.error("Failed updating song date", updErr);
                else {
                  results.updated.push({
                    id: exact.id,
                    title: exact.title,
                    artist: exact.artist,
                    old: exact.first_listen_date,
                    new: parsed,
                  });
                  if (debug)
                    decisions.push({
                      key,
                      action: "update",
                      title: exact.title,
                      artist: exact.artist,
                      iso: parsed,
                      existingId: exact.id,
                      existingSequence: exact.sequence,
                    });
                }
              }
            } catch (e) {
              console.error(
                "Failed handling exact with existing date update",
                e
              );
              const updatePayload = { first_listen_date: parsed };
              if (incomingTsIso) updatePayload.first_listen_ts = incomingTsIso;
              const { error: updErr } = await db
                .from("songs")
                .update(updatePayload)
                .eq("id", exact.id);
              if (updErr) console.error("Failed updating song date", updErr);
              if (debug)
                decisions.push({
                  key,
                  action: "update",
                  title: exact.title,
                  artist: exact.artist,
                  iso: parsed,
                  existingId: exact.id,
                });
            }
          } else {
            // debugging: log cases where we link even though parsed might be earlier (shouldn't happen)
            if (compareISO(parsed, exact.first_listen_date) < 0) {
              console.warn("Linking despite parsed < existingDate", {
                title: exact.title,
                artist: exact.artist,
                parsed,
                existing: exact.first_listen_date,
                seq: exact.sequence,
              });
            }
            results.linked.push({
              id: exact.id,
              title: exact.title,
              artist: exact.artist,
            });
            if (debug)
              decisions.push({
                key,
                action: "link",
                title: exact.title,
                artist: exact.artist,
                iso: parsed,
                existingId: exact.id,
                existingSequence: exact.sequence,
              });
          }
          continue;
        }

        // No existing date: infer using sequence position (find last dated song <= parsed, else append)
        try {
          const { data: lastDated } = await db
            .from("songs")
            .select("sequence")
            .lte("first_listen_date", parsed)
            .not("first_listen_date", "is", null)
            .order("first_listen_date", { ascending: false })
            .order("sequence", { ascending: false })
            .limit(1);
          let lastSeq =
            lastDated && lastDated.length ? lastDated[0].sequence : null;
          if (lastSeq == null) {
            const { data: maxSeqRows } = await db
              .from("songs")
              .select("sequence")
              .order("sequence", { ascending: false })
              .limit(1);
            lastSeq =
              maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
          }

          const existingSeq =
            typeof exact.sequence === "number" ? exact.sequence : null;

          // if existingSeq is <= lastSeq, treat existing as earlier (link).
          // Otherwise, move the existing row to the correct insertion position and set the date.
          const position = (lastSeq || 0) + 1;
          if (existingSeq !== null && existingSeq <= lastSeq) {
            results.linked.push({
              id: exact.id,
              title: exact.title,
              artist: exact.artist,
            });
            if (debug)
              decisions.push({
                key,
                action: "link",
                title: exact.title,
                artist: exact.artist,
                iso: parsed,
                existingId: exact.id,
                existingSequence: exact.sequence,
              });
          } else {
            try {
              // move rows in [position, existingSeq-1] up by 1 (descending to avoid conflicts)
              if (existingSeq !== null && existingSeq > position) {
                const { data: rowsToShift } = await db
                  .from("songs")
                  .select("id,sequence")
                  .gte("sequence", position)
                  .lt("sequence", existingSeq)
                  .order("sequence", { ascending: false });

                if (rowsToShift && rowsToShift.length) {
                  for (const row of rowsToShift) {
                    const { error: shiftErr } = await db
                      .from("songs")
                      .update({ sequence: row.sequence + 1 })
                      .eq("id", row.id);
                    if (shiftErr)
                      console.error(
                        "Failed shifting sequence for",
                        row.id,
                        shiftErr
                      );
                  }
                }

                // move exact song into position and set date
                const { error: updErr } = await db
                  .from("songs")
                  .update({ first_listen_date: parsed, sequence: position })
                  .eq("id", exact.id);
                if (updErr)
                  console.error("Failed moving existing song", updErr);
                else {
                  results.updated.push({
                    id: exact.id,
                    title: exact.title,
                    artist: exact.artist,
                    old: exact.first_listen_date,
                    new: parsed,
                  });
                  if (debug)
                    decisions.push({
                      key,
                      action: "update",
                      title: exact.title,
                      artist: exact.artist,
                      iso: parsed,
                      existingId: exact.id,
                      existingSequence: exact.sequence,
                      position,
                    });
                }
              } else {
                // existingSeq is null or already <= position, just set the date
                const { error: updErr } = await db
                  .from("songs")
                  .update({ first_listen_date: parsed })
                  .eq("id", exact.id);
                if (updErr) console.error("Failed updating song date", updErr);
                else {
                  results.updated.push({
                    id: exact.id,
                    title: exact.title,
                    artist: exact.artist,
                    old: exact.first_listen_date,
                    new: parsed,
                  });
                  if (debug)
                    decisions.push({
                      key,
                      action: "update",
                      title: exact.title,
                      artist: exact.artist,
                      iso: parsed,
                      existingId: exact.id,
                      existingSequence: exact.sequence,
                    });
                }
              }
            } catch (e) {
              console.error("Failed moving/updating existing song", e);
              // fallback: just update the date
              const { error: updErr } = await db
                .from("songs")
                .update({ first_listen_date: parsed })
                .eq("id", exact.id);
              if (updErr)
                console.error("Failed updating song date (fallback)", updErr);
              if (debug)
                decisions.push({
                  key,
                  action: "update",
                  title: exact.title,
                  artist: exact.artist,
                  iso: parsed,
                  existingId: exact.id,
                });
            }
          }
          continue;
        } catch (e) {
          console.error("Position lookup error", e);
          // fallback: treat as linked
          results.linked.push({
            id: exact.id,
            title: exact.title,
            artist: exact.artist,
          });
          continue;
        }
      }

      // No exact match -> compute insertion position by date using sequence-aware approach
      // Find the latest dated song whose date <= parsed, use its sequence + 1 as insertion position
      const { data: lastDated } = await db
        .from("songs")
        .select("sequence")
        .lte("first_listen_date", parsed)
        .not("first_listen_date", "is", null)
        .order("first_listen_date", { ascending: false })
        .order("sequence", { ascending: false })
        .limit(1);
      let lastSeq =
        lastDated && lastDated.length ? lastDated[0].sequence : null;
      if (lastSeq == null) {
        const { data: maxSeqRows } = await db
          .from("songs")
          .select("sequence")
          .order("sequence", { ascending: false })
          .limit(1);
        lastSeq = maxSeqRows && maxSeqRows.length ? maxSeqRows[0].sequence : 0;
      }
      const position = lastSeq + 1;

      // shift sequences >= position by +1 (descending order to avoid conflicts)
      const { data: rowsToShift } = await db
        .from("songs")
        .select("id,sequence")
        .gte("sequence", position)
        .order("sequence", { ascending: false });

      if (rowsToShift && rowsToShift.length) {
        for (const row of rowsToShift) {
          const { error: shiftErr } = await db
            .from("songs")
            .update({ sequence: row.sequence + 1 })
            .eq("id", row.id);
          if (shiftErr)
            console.error("Failed shifting sequence for", row.id, shiftErr);
        }
      }

      // insert new song at position
      const newSong = {
        title: t.title,
        artist: t.artist,
        norm_title: t.normTitle,
        norm_artist: t.normArtist,
        first_listen_date: parsed,
        sequence: position,
        curated: true,
      };
      if (incomingTsIso) newSong.first_listen_ts = incomingTsIso;
      const { data: created, error: createErr } = await db
        .from("songs")
        .insert([newSong])
        .select()
        .maybeSingle();
      if (createErr) {
        console.error("Failed creating song", createErr, newSong);
      } else {
        results.created.push({
          id: created.id,
          sequence: created.sequence,
          title: created.title,
          artist: created.artist,
        });
        if (debug)
          decisions.push({
            key,
            action: "create",
            title: created.title,
            artist: created.artist,
            iso: parsed,
            insertionPosition: created.sequence,
          });
      }
    }

    // best-effort: compact sequences after the import to ensure contiguous numbering
    try {
      const { error: reseqErr } = await db.rpc("resequence_songs");
      if (reseqErr) {
        if (reseqErr && reseqErr.code === "PGRST202") {
          try {
            const { resequenceSongsUsingSQL } = await import(
              "@/lib/resequenceSongs"
            );
            await resequenceSongsUsingSQL(db);
          } catch (fe) {
            console.error("resequence fallback failed", fe);
          }
        } else {
          console.error("resequence_songs rpc error", reseqErr);
        }
      }
    } catch (e) {
      console.error("resequence_songs call failed", e);
      try {
        const { resequenceSongsUsingSQL } = await import(
          "@/lib/resequenceSongs"
        );
        await resequenceSongsUsingSQL(db);
      } catch (fe) {
        console.error("resequence fallback failed after rpc exception", fe);
      }
    }

    return NextResponse.json({ success: true, results, decisions });
  } catch (err) {
    console.error("lastfm import failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
