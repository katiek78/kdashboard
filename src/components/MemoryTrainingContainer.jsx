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
  // Comp images import state
  const [showCompImport, setShowCompImport] = useState(false);
  const [compImportText, setCompImportText] = useState("");
  const [compOverwriteMode, setCompOverwriteMode] = useState("no-overwrite");
  const [compImportStatus, setCompImportStatus] = useState("");

  // Pi digits import state
  const [showPiImport, setShowPiImport] = useState(false);
  const [piDigitsText, setPiDigitsText] = useState("");
  const [piImportStatus, setPiImportStatus] = useState("");

  async function handleCompImport() {
    setCompImportStatus("Preparing import...");
    const lines = compImportText.split(/\r?\n/).filter(Boolean);
    const rows = lines
      .map((line) => {
        const [num, img] = line.includes("\t")
          ? line.split("\t")
          : line.split(/,|\s+/);
        return {
          num_string: num.trim(),
          comp_image: img ? img.trim() : "",
        };
      })
      .filter((row) => row.num_string && row.comp_image);
    if (!rows.length) {
      setCompImportStatus("No valid rows found.");
      return;
    }
    let success = 0,
      fail = 0,
      skipped = 0;
    const total = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const currentIndex = i + 1;

      // Update progress status
      setCompImportStatus(`Processing ${currentIndex} of ${total} items...`);
      // Ensure numberstring exists
      const { data: nsData } = await supabase
        .from("numberstrings")
        .select("num_string")
        .eq("num_string", row.num_string)
        .maybeSingle();
      if (!nsData) {
        const { error: nsInsertErr } = await supabase
          .from("numberstrings")
          .insert([{ num_string: row.num_string }]);
        if (nsInsertErr) {
          fail++;
          continue;
        }
      }
      // Check for existing comp_image and tricky flag
      const { data: compData } = await supabase
        .from("comp_images")
        .select("comp_image")
        .eq("num_string", row.num_string)
        .maybeSingle();
      const { data: trickyData } = await supabase
        .from("numberstrings")
        .select("four_digit_ben_tricky")
        .eq("num_string", row.num_string)
        .maybeSingle();
      const isTricky = !!(trickyData && trickyData.four_digit_ben_tricky);
      if (compOverwriteMode === "no-overwrite") {
        if (!compData) {
          // Insert new
          const { error } = await supabase
            .from("comp_images")
            .insert([
              { num_string: row.num_string, comp_image: row.comp_image },
            ]);
          if (error) fail++;
          else success++;
        } else {
          skipped++;
        }
      } else if (compOverwriteMode === "overwrite-non-tricky") {
        if (!isTricky) {
          // Upsert (insert or update)
          const { error } = await supabase
            .from("comp_images")
            .upsert(
              [{ num_string: row.num_string, comp_image: row.comp_image }],
              { onConflict: ["num_string"] }
            );
          if (error) fail++;
          else success++;
        } else {
          skipped++;
        }
      } else if (compOverwriteMode === "overwrite-all") {
        // Upsert (insert or update)
        const { error } = await supabase
          .from("comp_images")
          .upsert(
            [{ num_string: row.num_string, comp_image: row.comp_image }],
            { onConflict: ["num_string"] }
          );
        if (error) fail++;
        else success++;
      }

      // Small delay to allow UI to update
      if (currentIndex % 10 === 0 || currentIndex === total) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    setCompImportStatus(
      `Complete! Imported: ${success}, Skipped: ${skipped}, Failed: ${fail} (${total} total)`
    );
    setRefreshGrid((r) => r + 1);
  }

  async function handlePiImport() {
    setPiImportStatus("Importing pi digits...");

    // Clean the input - remove spaces, newlines, and any non-digit characters except decimal point
    const cleanDigits = piDigitsText.replace(/[^0-9]/g, "");

    if (cleanDigits.length < 10000) {
      setPiImportStatus(
        `Error: Need at least 10,000 digits, got ${cleanDigits.length}`
      );
      return;
    }

    // Skip the "3." at the beginning if present, we want digits after decimal
    const piDigits = cleanDigits.startsWith("3")
      ? cleanDigits.substring(1)
      : cleanDigits;

    if (piDigits.length < 10000) {
      setPiImportStatus(
        `Error: Need at least 10,000 digits after decimal, got ${piDigits.length}`
      );
      return;
    }

    let success = 0,
      fail = 0;

    // Process in chunks of 5 digits
    for (let i = 0; i < 2000; i++) {
      // 2000 chunks of 5 = 10,000 digits
      const position = i + 1;
      const startIndex = i * 5;
      const digits = piDigits.substring(startIndex, startIndex + 5);

      if (digits.length !== 5) break;

      try {
        const { error } = await supabase
          .from("pi_matrix")
          .upsert([{ position, digits }], {
            onConflict: ["position"],
          });

        if (error) {
          console.error(`Error updating position ${position}:`, error);
          fail++;
        } else {
          success++;
        }
      } catch (error) {
        console.error(`Exception updating position ${position}:`, error);
        fail++;
      }

      // Update status every 100 chunks
      if (position % 100 === 0) {
        setPiImportStatus(`Processing... ${position}/2000 chunks`);
        // Small delay to allow UI updates
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    setPiImportStatus(
      `Pi import complete: ${success} chunks updated, ${fail} failed`
    );
    setRefreshGrid((r) => r + 1);
  }

  // Supabase client (reuse env vars)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  async function handleImport() {
    setImportStatus("Preparing import...");
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
    const total = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const currentIndex = i + 1;

      // Update progress status
      setImportStatus(`Processing ${currentIndex} of ${total} items...`);
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

      // Small delay to allow UI to update
      if (currentIndex % 10 === 0 || currentIndex === total) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    setImportStatus(
      `Complete! Imported: ${success}, Failed: ${fail} (${total} total)`
    );
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

      <button
        onClick={() => setShowCompImport((v) => !v)}
        style={{ margin: "16px 0 0 16px" }}
      >
        {showCompImport ? "Hide Import Comp Images" : "Import Comp Images"}
      </button>
      {showCompImport && (
        <div
          style={{
            margin: "16px 0",
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
          }}
        >
          <h3>Import Comp Images</h3>
          <textarea
            value={compImportText}
            onChange={(e) => setCompImportText(e.target.value)}
            rows={10}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 14 }}
            placeholder={
              "Paste numberstring (2-digit, 3-digit, or 4-digit) and comp image, separated by tab, comma, or space. One per line."
            }
          />
          <div style={{ margin: "8px 0" }}>
            <label>Overwrite mode: </label>
            <select
              value={compOverwriteMode}
              onChange={(e) => setCompOverwriteMode(e.target.value)}
            >
              <option value="no-overwrite">Do not overwrite</option>
              <option value="overwrite-non-tricky">
                Overwrite non-tricky images
              </option>
              <option value="overwrite-all">Overwrite all images</option>
            </select>
          </div>
          <button onClick={handleCompImport}>Import</button>
          <span style={{ marginLeft: 12 }}>{compImportStatus}</span>
        </div>
      )}

      <button
        onClick={() => setShowPiImport((v) => !v)}
        style={{ margin: "16px 0 0 16px" }}
      >
        {showPiImport ? "Hide Import Pi Digits" : "Import Pi Digits"}
      </button>
      {showPiImport && (
        <div
          style={{
            margin: "16px 0",
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
            backgroundColor: "#fff9e6", // Light yellow background for emphasis
          }}
        >
          <h3>Import Pi Digits</h3>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "12px" }}>
            Paste the first 10,000+ digits of pi (after the decimal point). This
            will update the pi_matrix table with the correct digits. Example:
            141592653589793238462643383279...
          </p>
          <textarea
            value={piDigitsText}
            onChange={(e) => setPiDigitsText(e.target.value)}
            rows={8}
            style={{
              width: "100%",
              fontFamily: "monospace",
              fontSize: 12,
              lineHeight: 1.2,
            }}
            placeholder="141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273724587006606315588174881520920962829254091715364367892590360011330530548820466521384146951941511609433057270365759591953092186117381932611793105118548074462379962749567351885752724891227938183011949129833673362440656643086021394946395224737190702179860943702770539217176293176752384674818467669405132000568127145263560827785771342757789609173637178721468440901224953430146549585371050792279689258923542019956112129021960864034418159813629774771309960518707211349999998372978049951059731732816096318595024459455346908302642522308253344685035261931188171010003137838752886587533208381420617177669147303598253490428755468731159562863882353787593751957781857780532171226806613001927876611195909216420198938367586366677661732319

Or paste from a reliable source like:
• https://www.piday.org/million/
• Mathematical software output
• Trusted pi calculation"
          />
          <div style={{ margin: "12px 0 8px 0", fontSize: "14px" }}>
            <strong>Character count:</strong>{" "}
            {piDigitsText.replace(/[^0-9]/g, "").length} digits
          </div>
          <button
            onClick={handlePiImport}
            style={{
              backgroundColor: "#ff6b35",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            Import Pi Digits
          </button>
          <span style={{ marginLeft: 12, fontWeight: "bold" }}>
            {piImportStatus}
          </span>
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
