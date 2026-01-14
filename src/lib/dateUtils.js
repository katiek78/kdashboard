// Utility for parsing user-provided dates into ISO (YYYY-MM-DD)
// Behavior: treat numeric dates as day-first (DD/MM/YYYY), do NOT accept MM/DD/YYYY

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function isValidYMD(y, m, d) {
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function parseDateToISO(input) {
  if (!input && input !== 0) return null;
  let s = String(input).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidYMD(y, m, d)) return `${y}-${pad(m)}-${pad(d)}`;
    return null;
  }

  // Numeric day-first formats: D/M/YYYY or D-M-YYYY or D.M.YYYY or D M YYYY
  // Accept 2- or 4-digit year numeric day-first formats: D/M/YYYY or D/M/YY
  const numeric = s.match(/^(\d{1,2})[\/\.\-\s](\d{1,2})[\/\.\-\s](\d{2,4})$/);
  if (numeric) {
    const dd = Number(numeric[1]);
    const mm = Number(numeric[2]);
    let yyyy = numeric[3].length === 2 ? null : Number(numeric[3]);
    // If year is two digits, infer century: 70-99 -> 1900s, else 2000s
    if (numeric[3].length === 2) {
      const yy = Number(numeric[3]);
      yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    }
    // Interpret as day-first (DD/MM/YYYY). Do NOT accept MM/DD/YYYY.
    if (isValidYMD(yyyy, mm, dd)) return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    return null;
  }

  // Day MonthName Year e.g., 30 Jun 2005, 3 June 2005
  const dmyText = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmyText) {
    const d = Number(dmyText[1]);
    const mName = dmyText[2].toLowerCase();
    const y = Number(dmyText[3]);
    const m = MONTHS[mName];
    if (m && isValidYMD(y, m, d)) return `${y}-${pad(m)}-${pad(d)}`;
    return null;
  }

  // MonthName Day, Year e.g., Jun 30, 2005 or June 30 2005
  const mdyText = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdyText) {
    const mName = mdyText[1].toLowerCase();
    const d = Number(mdyText[2]);
    const y = Number(mdyText[3]);
    const m = MONTHS[mName];
    if (m && isValidYMD(y, m, d)) return `${y}-${pad(m)}-${pad(d)}`;
    return null;
  }

  // Fallback: try Date.parse only if it results in a date with a textual month or ISO-like string
  // We avoid accepting ambiguous numeric US-style dates.
  // If input contains letters (month names) or a comma, try Date.parse
  if (/[A-Za-z,]/.test(s)) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      if (isValidYMD(y, m, d)) return `${y}-${pad(m)}-${pad(d)}`;
    }
  }

  return null;
}

export function formatISOToDisplay(iso) {
  if (!iso) return "";
  // expect iso in YYYY-MM-DD
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.toLocaleDateString();
}
