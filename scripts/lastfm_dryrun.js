const fs = require("fs");
const path = require("path");
const fetch = global.fetch || require("node-fetch");

function loadEnvKey() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return null;
  const txt = fs.readFileSync(envPath, "utf8");
  const m = txt.match(/^LASTFM_API_KEY=(.+)$/m);
  return m ? m[1].trim() : null;
}

async function main() {
  const key = loadEnvKey();
  if (!key) {
    console.error("Missing LASTFM_API_KEY in .env.local");
    process.exit(2);
  }

  const username = "discokate";
  const from = Math.floor(new Date("2006-11-27T00:00:00Z").getTime() / 1000);
  const to = Math.floor(new Date("2006-11-28T23:59:59Z").getTime() / 1000);
  const limit = 200;

  console.log(`Fetching Last.fm for ${username} from ${from} to ${to}`);
  let page = 1;
  let totalPages = 1;
  const all = [];

  while (page <= totalPages) {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "user.getrecenttracks");
    url.searchParams.set("user", username);
    url.searchParams.set("api_key", key);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", String(page));
    url.searchParams.set("from", String(from));
    url.searchParams.set("to", String(to));

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "kdashboard lastfm-dryrun" },
    });
    if (!res.ok) {
      console.error("Last.fm error", res.status, await res.text());
      process.exit(2);
    }
    const payload = await res.json();
    const raw = payload?.recenttracks?.track || [];
    const attr = payload?.recenttracks?.["@attr"] || {};
    totalPages = Number(attr.totalPages || 1);
    const total = Number(attr.total || 0);
    console.log(
      `Page ${page}/${totalPages} - raw returned: ${raw.length} (total attr.total=${total})`
    );

    for (const t of raw) all.push(t);
    page += 1;
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`Fetched total plays: ${all.length}`);

  const dated = all
    .filter((t) => t.date && t.date.uts)
    .map((t) => ({
      unix: Number(t.date.uts),
      iso: new Date(Number(t.date.uts) * 1000).toISOString().split("T")[0],
      title: t.name || "",
      artist: (t.artist && (t.artist["#text"] || t.artist.name)) || "",
      nowplaying: !!t["@attr"] && t["@attr"].nowplaying === "true",
    }));

  console.log(`Dated plays count: ${dated.length}`);
  if (dated.length === 0) process.exit(0);

  // Normalize strings using the same logic as normalizeString in musicImportUtils.js
  function stripBracketed(text) {
    if (!text) return text;
    return text.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*/g, " ").trim();
  }
  function normalizeString(text) {
    if (!text) return "";
    let s = text.toLowerCase().trim();
    s = stripBracketed(s);
    s = s.replace(/[\p{P}]/gu, "");
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  const keyCounts = {};
  for (const d of dated) {
    const normTitle = normalizeString(d.title);
    const normArtist = normalizeString(d.artist);
    const key = `${normTitle}|||${normArtist}`;
    keyCounts[key] = (keyCounts[key] || 0) + 1;
  }
  const uniqueCount = Object.keys(keyCounts).length;
  const duplicates = Object.entries(keyCounts)
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]);

  console.log(`Unique normalized songs in range: ${uniqueCount}`);
  console.log(
    `Number of titles with duplicates (count>1): ${duplicates.length}`
  );
  if (duplicates.length > 0) {
    console.log("Top duplicates:");
    duplicates.slice(0, 30).forEach(([k, c]) => {
      const [t, a] = k.split("|||");
      console.log(`${c}x — ${t} — ${a}`);
    });
  }

  console.log("\nDated plays (oldest->newest):");
  dated.sort((a, b) => a.unix - b.unix);
  dated.forEach((d, i) => {
    console.log(`${i + 1}. ${d.iso} - ${d.title} — ${d.artist}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
