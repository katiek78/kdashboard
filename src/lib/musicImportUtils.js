import supabase from "@/utils/supabaseClient";

export function stripBracketed(text) {
  if (!text) return text;
  // Remove parentheses, brackets, braces and their contents
  return text.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*/g, " ").trim();
}

export function normalizeString(text) {
  if (!text) return "";
  let s = text.toLowerCase().trim();
  s = stripBracketed(s);
  // remove punctuation except letters numbers and spaces
  s = s.replace(/[\p{P}]/gu, "");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function detectDelimiter(sample) {
  if (sample.includes("\t")) return "\t";
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  if (commaCount >= semicolonCount && commaCount > 0) return ",";
  if (semicolonCount > 0) return ";";
  return "\t"; // default to tab
}

export function parseTextToRows(text, delimiter = "\t", hasHeader = false) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  let headers = null;
  let startIndex = 0;
  if (hasHeader) {
    headers = lines[0].split(delimiter).map((h) => h.trim());
    startIndex = 1;
  }

  const rows = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map((p) => p.trim());
    rows.push({ original: lines[i], parts });
  }

  return { headers, rows };
}

// trigram-based similarity helpers
function generateTrigrams(s) {
  if (!s) return new Set();
  const str = `  ${s}  `; // pad with spaces to capture boundaries
  const trigrams = new Set();
  for (let i = 0; i < str.length - 2; i++) {
    trigrams.add(str.slice(i, i + 3));
  }
  return trigrams;
}

function trigramJaccard(a, b) {
  const A = generateTrigrams(a);
  const B = generateTrigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function similarityScore(a, b) {
  if (!a || !b) return 0;
  // weighted average of title and artist trigrams could be used externally
  return trigramJaccard(a, b);
}

export async function findExactMatch(normArtist, normTitle) {
  if (!normArtist || !normTitle) return null;
  const { data, error } = await supabase
    .from("songs")
    .select(
      "id, title, artist, sequence, first_listen_date, norm_title, norm_artist"
    )
    .eq("norm_artist", normArtist)
    .eq("norm_title", normTitle)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Supabase match error", error);
    return null;
  }
  return data || null;
}

export async function findFuzzyMatch(
  normArtist,
  normTitle,
  maxCandidates = 50
) {
  if ((!normArtist || !normTitle) && !normTitle && !normArtist) return null;

  const token =
    (normTitle && normTitle.split(" ")[0]) ||
    (normArtist && normArtist.split(" ")[0]) ||
    "";
  const tokenLike = `%${token}%`;

  try {
    const { data: candidates = [] } = await supabase
      .from("songs")
      .select(
        "id, title, artist, sequence, first_listen_date, norm_title, norm_artist"
      )
      .or(`norm_title.ilike.${tokenLike},norm_artist.ilike.${tokenLike}`)
      .limit(maxCandidates);

    if (!candidates || candidates.length === 0) return null;

    let best = null;
    for (const c of candidates) {
      const titleScore = similarityScore(normTitle, c.norm_title || "");
      const artistScore = similarityScore(normArtist, c.norm_artist || "");
      const score = titleScore * 0.6 + artistScore * 0.4; // weight title higher
      if (!best || score > best.score) {
        best = {
          id: c.id,
          title: c.title,
          artist: c.artist,
          sequence: c.sequence,
          first_listen_date: c.first_listen_date,
          score,
        };
      }
    }

    return best;
  } catch (err) {
    console.error("findFuzzyMatch error", err);
    return null;
  }
}
