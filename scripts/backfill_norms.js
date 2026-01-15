const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Helper to load .env.local if present (simple parser)
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2] || "";
    // strip surrounding quotes
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) in env or .env.local"
  );
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function stripBracketed(text) {
  if (!text) return text;
  return text.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*/g, " ").trim();
}

function normalizeString(text) {
  if (!text) return "";
  let s = String(text).toLowerCase().trim();
  s = stripBracketed(s);

  // Treat ampersand as 'and'
  s = s.replace(/&/g, " and ");

  // Normalize common contraction: hangin' -> hanging
  s = s.replace(/in['’]\b/g, "ing");

  // Replace single digits with their word equivalents
  const digitWords = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ];
  s = s.replace(/[0-9]/g, (m) => ` ${digitWords[Number(m)]} `);

  // remove leading articles
  s = s.replace(/^(a|an|the)\s+/i, "");
  s = s.replace(/[\p{P}]/gu, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

async function main() {
  const dry = process.argv.includes("--dry");
  console.log(`Backfill norms: dry run = ${dry}`);

  const pageSize = 1000;
  let offset = 0;
  let totalUpdated = 0;
  while (true) {
    const rangeStart = offset;
    const rangeEnd = offset + pageSize - 1;
    const { data: rows, error } = await supabase
      .from("songs")
      .select("id,title,artist,norm_title,norm_artist")
      .range(rangeStart, rangeEnd);
    if (error) {
      console.error("Failed fetching songs", error);
      process.exit(2);
    }
    if (!rows || rows.length === 0) break;

    for (const r of rows) {
      const newNormTitle = normalizeString(r.title);
      const newNormArtist = normalizeString(r.artist);
      const needsUpdate =
        !r.norm_title ||
        r.norm_title.trim() === "" ||
        r.norm_title !== newNormTitle ||
        !r.norm_artist ||
        r.norm_artist.trim() === "" ||
        r.norm_artist !== newNormArtist;
      if (!needsUpdate) continue;
      console.log(
        `Will update id=${r.id}: norm_title='${r.norm_title}' => '${newNormTitle}', norm_artist='${r.norm_artist}' => '${newNormArtist}'`
      );
      if (!dry) {
        const { error: uErr } = await supabase
          .from("songs")
          .update({ norm_title: newNormTitle, norm_artist: newNormArtist })
          .eq("id", r.id);
        if (uErr) console.error("Failed updating", r.id, uErr);
        else totalUpdated++;
      }
    }

    offset += pageSize;
  }

  console.log(
    dry
      ? "Dry run complete. No updates applied."
      : `Backfill complete. Updated ${totalUpdated} rows.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
