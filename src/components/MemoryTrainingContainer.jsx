import styles from "./MemoryTrainingContainer.module.css";
import FourDigitGrid from "./FourDigitGrid";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function MemoryTrainingContainer() {
  const [refreshGrid, setRefreshGrid] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  // Supabase client (reuse env vars)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  async function handleImport() {
    setImportStatus("Importing...");
    // Parse input: expect lines of numstring<tab or comma>category_image
    const lines = importText.split(/\r?\n/).filter(Boolean);
    const rows = lines
      .map((line) => {
        const [num, img] = line.includes("\t")
          ? line.split("\t")
          : line.split(/,|\s+/);
        return {
          num_string: num.trim(),
          category_image: img ? img.trim() : "",
        };
      })
      .filter((row) => row.num_string && row.category_image);
    if (!rows.length) {
      setImportStatus("No valid rows found.");
      return;
    }
    let success = 0,
      fail = 0;
    for (const row of rows) {
      // Ensure numberstring exists
      const { data: nsData, error: nsError } = await supabase
        .from("numberstrings")
        .select("num_string")
        .eq("num_string", row.num_string)
        .maybeSingle();
      if (!nsData) {
        // Insert minimal numberstring row
        const { error: nsInsertErr } = await supabase
          .from("numberstrings")
          .insert([{ num_string: row.num_string }]);
        if (nsInsertErr) {
          fail++;
          continue;
        }
      }
      if (overwrite) {
        // Upsert (insert or update)
        const { error } = await supabase.from("category_images").upsert(
          [
            {
              num_string: row.num_string,
              category_image: row.category_image,
            },
          ],
          { onConflict: ["num_string"] }
        );
        if (error) fail++;
        else success++;
      } else {
        // Insert only if not exists
        const { data, error } = await supabase
          .from("category_images")
          .select("num_string")
          .eq("num_string", row.num_string)
          .maybeSingle();
        if (!data) {
          const { error: insErr } = await supabase
            .from("category_images")
            .insert([
              {
                num_string: row.num_string,
                category_image: row.category_image,
              },
            ]);
          if (insErr) fail++;
          else success++;
        } else {
          // Already exists, skip
          continue;
        }
      }
    }
    setImportStatus(`Imported: ${success}, Failed: ${fail}`);
    setRefreshGrid((r) => r + 1);
  }

  return (
    <div className={styles.memoryContainer + " pageContainer"}>
      <h1>Image systems</h1>
      <h2>4-digit Ben System</h2>
      <FourDigitGrid refresh={refreshGrid} />

      <button
        onClick={() => setShowImport((v) => !v)}
        style={{ margin: "16px 0" }}
      >
        {showImport ? "Hide Import Category Images" : "Import Category Images"}
      </button>
      {showImport && (
        <div
          style={{
            margin: "16px 0",
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
          }}
        >
          <h3>Import Category Images</h3>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 14 }}
            placeholder={
              "Paste numberstring and category image, separated by tab, comma, or space. One per line."
            }
          />
          <div style={{ margin: "8px 0" }}>
            <label>
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              Overwrite existing images
            </label>
          </div>
          <button onClick={handleImport}>Import</button>
          <span style={{ marginLeft: 12 }}>{importStatus}</span>
        </div>
      )}

      <h3>To-dos</h3>
      <ul>
        <li>Show tricky only</li>
        <li>Show duplicates</li>
      </ul>
    </div>
  );
}
