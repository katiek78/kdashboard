import styles from "./MemoryTrainingContainer.module.css";
import FourDigitGrid from "./FourDigitGrid";
import { useState } from "react";
import { getNumberPhonetics } from "../utils/memTrainingUtils";
import supabase from "../utils/supabaseClient";

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

  // Duplicate detection state
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateType, setDuplicateType] = useState("comp"); // "comp" or "category"
  const [duplicatesData, setDuplicatesData] = useState([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [includeCrossLength, setIncludeCrossLength] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editImageValue, setEditImageValue] = useState("");
  const [markAsTricky, setMarkAsTricky] = useState(false);

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

    const total = rows.length;
    let success = 0,
      fail = 0,
      skipped = 0;

    try {
      // Step 1: Batch fetch all existing data we need (in chunks to avoid query limits)
      setCompImportStatus("Fetching existing data...");
      const numStrings = rows.map((r) => r.num_string);

      const existingNs = new Set();
      const existingComp = new Map();
      const trickyFlags = new Map();

      // Process in chunks of 1000 to avoid database query limits
      const chunkSize = 1000;
      for (let i = 0; i < numStrings.length; i += chunkSize) {
        const chunk = numStrings.slice(i, i + chunkSize);
        const progress = Math.min(i + chunkSize, numStrings.length);
        setCompImportStatus(
          `Fetching existing data... ${progress}/${numStrings.length}`
        );

        const [existingNsResult, existingCompResult, trickyResult] =
          await Promise.all([
            supabase
              .from("numberstrings")
              .select("num_string")
              .in("num_string", chunk),
            supabase
              .from("comp_images")
              .select("num_string, comp_image")
              .in("num_string", chunk),
            supabase
              .from("numberstrings")
              .select("num_string, four_digit_ben_tricky")
              .in("num_string", chunk),
          ]);

        // Add to our sets/maps
        (existingNsResult.data || []).forEach((r) =>
          existingNs.add(r.num_string)
        );
        (existingCompResult.data || []).forEach((r) =>
          existingComp.set(r.num_string, r.comp_image)
        );
        (trickyResult.data || []).forEach((r) =>
          trickyFlags.set(r.num_string, !!r.four_digit_ben_tricky)
        );
      }

      // Step 2: Batch insert missing numberstrings
      const missingNs = rows.filter((r) => !existingNs.has(r.num_string));
      if (missingNs.length > 0) {
        setCompImportStatus(
          `Creating ${missingNs.length} missing numberstrings...`
        );
        const { error: nsError } = await supabase
          .from("numberstrings")
          .insert(missingNs.map((r) => ({ num_string: r.num_string })));
        if (nsError) {
          console.error("Error batch inserting numberstrings:", nsError);
        }
      }

      // Step 3: Process in batches of 50 for comp_images
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const progress = Math.min(i + batchSize, rows.length);
        setCompImportStatus(`Processing batch ${progress}/${total}...`);

        const toProcess = [];

        for (const row of batch) {
          const hasExisting = existingComp.has(row.num_string);
          const isTricky = trickyFlags.get(row.num_string) || false;

          if (compOverwriteMode === "no-overwrite") {
            if (!hasExisting) {
              toProcess.push(row);
            } else {
              skipped++;
            }
          } else if (compOverwriteMode === "overwrite-non-tricky") {
            if (!isTricky) {
              toProcess.push(row);
            } else {
              skipped++;
            }
          } else if (compOverwriteMode === "overwrite-all") {
            toProcess.push(row);
          }
        }

        // Process inserts and updates separately
        if (toProcess.length > 0) {
          const toInsert = [];
          const toUpdate = [];

          for (const row of toProcess) {
            if (existingComp.has(row.num_string)) {
              toUpdate.push(row);
            } else {
              toInsert.push(row);
            }
          }

          // Batch insert new records
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("comp_images")
              .insert(
                toInsert.map((r) => ({
                  num_string: r.num_string,
                  comp_image: r.comp_image,
                }))
              );

            if (insertError) {
              console.error("Batch insert error:", insertError);
              fail += toInsert.length;
            } else {
              success += toInsert.length;
            }
          }

          // Update existing records one by one (since bulk update by num_string is complex)
          for (const row of toUpdate) {
            const { error: updateError } = await supabase
              .from("comp_images")
              .update({ comp_image: row.comp_image })
              .eq("num_string", row.num_string);

            if (updateError) {
              console.error("Update error for", row.num_string, updateError);
              fail++;
            } else {
              success++;
            }
          }
        }

        // Small delay to allow UI updates
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error("Import error:", error);
      setCompImportStatus(`Error: ${error.message}`);
      return;
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

  async function findDuplicates() {
    setLoadingDuplicates(true);
    try {
      const tableName =
        duplicateType === "comp" ? "comp_images" : "category_images";
      const imageColumn =
        duplicateType === "comp" ? "comp_image" : "category_image";

      // Fetch ALL records by pagination to avoid row limits
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select(`num_string, ${imageColumn}`)
          .not(imageColumn, "is", null)
          .not(imageColumn, "eq", "")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        page++;

        // Update loading status to show progress
        if (hasMore) {
          setLoadingDuplicates(`Scanning records... ${allData.length} loaded`);
        }
      }

      // Reset loading to true for processing phase
      setLoadingDuplicates(true);

      // Group by image and find duplicates
      const imageGroups = {};
      allData.forEach((row) => {
        const image = row[imageColumn];
        if (!imageGroups[image]) {
          imageGroups[image] = [];
        }
        imageGroups[image].push(row.num_string);
      });

      // Filter to include: 1) duplicates (2+ occurrences) OR 2) items with 'duplicate' in name
      const duplicates = Object.entries(imageGroups)
        .filter(([image, numStrings]) => {
          const hasMultiple = numStrings.length > 1;
          const hasAutoDetected = image.toLowerCase().includes("duplicate");

          // Always include single entries with 'duplicate' in name
          if (!hasMultiple && hasAutoDetected) {
            return true;
          }

          // For multiple entries, check cross-length setting
          if (hasMultiple) {
            if (!includeCrossLength) {
              // Only include if all number strings have the same length
              const lengths = new Set(numStrings.map((ns) => ns.length));
              return lengths.size === 1;
            }
            return true;
          }

          return false;
        })
        .map(([image, numStrings]) => ({
          image,
          numStrings: numStrings.sort(),
          count: numStrings.length,
          hasAutoDetectedDuplicate: image.toLowerCase().includes("duplicate"),
          isDuplicateByName:
            image.toLowerCase().includes("duplicate") &&
            numStrings.length === 1,
        }))
        .sort((a, b) => {
          // Sort auto-detected duplicates first, then by image name
          if (a.hasAutoDetectedDuplicate && !b.hasAutoDetectedDuplicate)
            return -1;
          if (!a.hasAutoDetectedDuplicate && b.hasAutoDetectedDuplicate)
            return 1;
          return a.image.localeCompare(b.image);
        });

      setDuplicatesData(duplicates);
    } catch (error) {
      console.error("Error finding duplicates:", error);
    }
    setLoadingDuplicates(false);
  }

  async function openEditModal(numString, currentImage) {
    setMarkAsTricky(false);

    try {
      const tableName =
        duplicateType === "comp" ? "comp_images" : "category_images";
      const imageColumn =
        duplicateType === "comp" ? "comp_image" : "category_image";

      // Fetch the current image value from database
      const { data, error } = await supabase
        .from(tableName)
        .select(imageColumn)
        .eq("num_string", numString)
        .single();

      const actualCurrentImage = data?.[imageColumn] || currentImage;

      setEditingEntry({ numString, currentImage: actualCurrentImage });
      setEditImageValue(actualCurrentImage);

      // If we're editing comp images, also fetch the category image for potential tricky marking
      if (duplicateType === "comp") {
        try {
          const { data: categoryData, error: categoryError } = await supabase
            .from("category_images")
            .select("category_image")
            .eq("num_string", numString)
            .single();

          if (!categoryError && categoryData) {
            setEditingEntry({
              numString,
              currentImage: actualCurrentImage,
              categoryImage: categoryData.category_image,
            });
          }
        } catch (error) {
          console.log("No category image found for", numString);
        }
      }
    } catch (error) {
      console.error("Error fetching current image:", error);
      // Fallback to the passed currentImage
      setEditingEntry({ numString, currentImage });
      setEditImageValue(currentImage);
    }

    setShowEditModal(true);
  }

  async function saveImageEdit() {
    if (!editingEntry) return;

    try {
      let finalImageValue = editImageValue;

      // If marking as tricky and we're editing comp images, use category image
      if (
        markAsTricky &&
        duplicateType === "comp" &&
        editingEntry.categoryImage
      ) {
        finalImageValue = editingEntry.categoryImage;
      }

      const tableName =
        duplicateType === "comp" ? "comp_images" : "category_images";
      const imageColumn =
        duplicateType === "comp" ? "comp_image" : "category_image";

      // Update the image
      const { error: imageError } = await supabase
        .from(tableName)
        .update({ [imageColumn]: finalImageValue })
        .eq("num_string", editingEntry.numString);

      if (imageError) throw imageError;

      // If marking as tricky, update the numberstrings table
      if (markAsTricky) {
        const { error: trickyError } = await supabase
          .from("numberstrings")
          .update({ four_digit_ben_tricky: true })
          .eq("num_string", editingEntry.numString);

        if (trickyError) throw trickyError;
      }

      // Close modal and refresh grid only (no rescan)
      setShowEditModal(false);
      setEditingEntry(null);
      setEditImageValue("");
      setMarkAsTricky(false);
      setRefreshGrid((r) => r + 1);
    } catch (error) {
      console.error("Error updating image:", error);
    }
  }

  function cancelEdit() {
    setShowEditModal(false);
    setEditingEntry(null);
    setEditImageValue("");
    setMarkAsTricky(false);
  }

  function removeDuplicateFromList(imageToRemove) {
    setDuplicatesData((prev) =>
      prev.filter((dup) => dup.image !== imageToRemove)
    );
  }

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

    const total = rows.length;
    let success = 0,
      fail = 0;

    try {
      // Step 1: Batch fetch existing data (in chunks to avoid query limits)
      setImportStatus("Fetching existing data...");
      const numStrings = rows.map((r) => r.num_string);

      const existingNs = new Set();
      const existingCat = new Set();

      // Process in chunks of 1000 to avoid database query limits
      const chunkSize = 1000;
      for (let i = 0; i < numStrings.length; i += chunkSize) {
        const chunk = numStrings.slice(i, i + chunkSize);
        const progress = Math.min(i + chunkSize, numStrings.length);
        setImportStatus(
          `Fetching existing data... ${progress}/${numStrings.length}`
        );

        const [existingNsResult, existingCatResult] = await Promise.all([
          supabase
            .from("numberstrings")
            .select("num_string")
            .in("num_string", chunk),
          supabase
            .from("category_images")
            .select("num_string")
            .in("num_string", chunk),
        ]);

        // Add to our sets
        (existingNsResult.data || []).forEach((r) =>
          existingNs.add(r.num_string)
        );
        (existingCatResult.data || []).forEach((r) =>
          existingCat.add(r.num_string)
        );
      }

      // Step 2: Batch insert missing numberstrings
      const missingNs = rows.filter((r) => !existingNs.has(r.num_string));
      if (missingNs.length > 0) {
        setImportStatus(
          `Creating ${missingNs.length} missing numberstrings...`
        );
        const { error: nsError } = await supabase
          .from("numberstrings")
          .insert(missingNs.map((r) => ({ num_string: r.num_string })));
        if (nsError) {
          console.error("Error batch inserting numberstrings:", nsError);
        }
      }

      // Step 3: Process category images in batches
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const progress = Math.min(i + batchSize, rows.length);
        setImportStatus(`Processing batch ${progress}/${total}...`);

        const toProcess = [];

        for (const row of batch) {
          const hasExisting = existingCat.has(row.num_string);

          if (overwrite || !hasExisting) {
            toProcess.push(row);
          }
          // If not overwriting and already exists, we skip (no increment needed)
        }

        // Process inserts and updates separately
        if (toProcess.length > 0) {
          const toInsert = [];
          const toUpdate = [];

          for (const row of toProcess) {
            if (existingCat.has(row.num_string)) {
              toUpdate.push(row);
            } else {
              toInsert.push(row);
            }
          }

          // Batch insert new records
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("category_images")
              .insert(
                toInsert.map((r) => ({
                  num_string: r.num_string,
                  category_image: r.category_image,
                }))
              );

            if (insertError) {
              console.error("Batch insert error:", insertError);
              fail += toInsert.length;
            } else {
              success += toInsert.length;
            }
          }

          // Update existing records one by one (since bulk update by num_string is complex)
          for (const row of toUpdate) {
            const { error: updateError } = await supabase
              .from("category_images")
              .update({ category_image: row.category_image })
              .eq("num_string", row.num_string);

            if (updateError) {
              console.error("Update error for", row.num_string, updateError);
              fail++;
            } else {
              success++;
            }
          }
        }

        // Small delay to allow UI updates
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportStatus(`Error: ${error.message}`);
      return;
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

      <button
        onClick={() => setShowDuplicates((v) => !v)}
        style={{ margin: "16px 0 0 16px" }}
      >
        {showDuplicates ? "Hide Duplicates" : "Find Duplicates"}
      </button>

      {showDuplicates && (
        <div
          style={{
            margin: "16px 0",
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
            backgroundColor: "#f8f9fa",
          }}
        >
          <h3>Find & Resolve Duplicates</h3>

          <div style={{ margin: "8px 0" }}>
            <div style={{ marginBottom: "8px" }}>
              <label>Search in: </label>
              <select
                value={duplicateType}
                onChange={(e) => setDuplicateType(e.target.value)}
              >
                <option value="comp">Comp Images</option>
                <option value="category">Category Images</option>
              </select>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "14px",
                }}
              >
                <input
                  type="checkbox"
                  checked={includeCrossLength}
                  onChange={(e) => setIncludeCrossLength(e.target.checked)}
                />
                Include cross-length duplicates (e.g., 615 and 6615 with same
                image)
              </label>
            </div>

            <button onClick={findDuplicates} disabled={loadingDuplicates}>
              {loadingDuplicates
                ? typeof loadingDuplicates === "string"
                  ? loadingDuplicates
                  : "Searching..."
                : "Find Duplicates"}
            </button>
          </div>

          {duplicatesData.length > 0 && (
            <div>
              <p>
                <strong>
                  {duplicatesData.length} issues found (
                  {duplicatesData.filter((d) => d.count > 1).length} true
                  duplicates,{" "}
                  {duplicatesData.filter((d) => d.isDuplicateByName).length}{" "}
                  flagged entries)
                </strong>
                <br />
                <span
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    fontStyle: "italic",
                  }}
                >
                  Click × to remove entries from this list after editing. Re-run
                  "Find Duplicates" to refresh the full list.
                </span>
              </p>
              {duplicatesData.map((dup, index) => (
                <div
                  key={index}
                  style={{
                    margin: "12px 0",
                    padding: 12,
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    backgroundColor: dup.hasAutoDetectedDuplicate
                      ? "#fff3cd"
                      : "white",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          color: dup.hasAutoDetectedDuplicate
                            ? "#856404"
                            : "black",
                        }}
                      >
                        {dup.image}
                      </strong>
                      {dup.hasAutoDetectedDuplicate && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "12px",
                            color: "#856404",
                            fontWeight: "bold",
                          }}
                        >
                          (AUTO-DETECTED)
                        </span>
                      )}
                      {dup.isDuplicateByName && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "12px",
                            color: "#856404",
                            fontWeight: "bold",
                          }}
                        >
                          (FLAGGED FOR REVIEW)
                        </span>
                      )}
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "14px",
                          color: "#666",
                        }}
                      >
                        ({dup.count} occurrence{dup.count > 1 ? "s" : ""})
                      </span>
                    </div>
                    <button
                      onClick={() => removeDuplicateFromList(dup.image)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "18px",
                        color: "#dc3545",
                        cursor: "pointer",
                        padding: "0 4px",
                        lineHeight: "1",
                      }}
                      title="Remove from list"
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontSize: "14px", marginBottom: 8 }}>
                    <strong>Number strings:</strong>{" "}
                    {dup.numStrings.map((numString, idx) => (
                      <span key={numString}>
                        {idx > 0 && ", "}
                        {numString}
                        <span style={{ color: "#666", fontStyle: "italic" }}>
                          ({getNumberPhonetics(numString) || "no phonetics"})
                        </span>
                      </span>
                    ))}
                  </div>
                  <div>
                    {dup.numStrings.map((numString) => (
                      <button
                        key={numString}
                        onClick={() => openEditModal(numString, dup.image)}
                        style={{
                          margin: "2px 4px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          backgroundColor: "#007bff",
                          color: "white",
                          border: "none",
                          borderRadius: 3,
                          cursor: "pointer",
                        }}
                      >
                        Edit {numString}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {duplicatesData.length === 0 && !loadingDuplicates && (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              No duplicates found. Click "Find Duplicates" to search.
            </p>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "8px",
              minWidth: "400px",
              maxWidth: "500px",
            }}
          >
            <h3>Edit {duplicateType === "comp" ? "Comp" : "Category"} Image</h3>
            <div style={{ margin: "16px 0" }}>
              <label style={{ display: "block", marginBottom: "8px" }}>
                Number String: <strong>{editingEntry?.numString}</strong>
              </label>
              <label style={{ display: "block", marginBottom: "8px" }}>
                Current Image: <strong>{editingEntry?.currentImage}</strong>
              </label>
              <label style={{ display: "block", marginBottom: "8px" }}>
                New Image:
              </label>
              <input
                type="text"
                value={editImageValue}
                onChange={(e) => setEditImageValue(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
                placeholder="Enter new image name..."
              />

              {duplicateType === "comp" && editingEntry?.categoryImage && (
                <div style={{ marginTop: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={markAsTricky}
                      onChange={(e) => {
                        setMarkAsTricky(e.target.checked);
                        if (e.target.checked) {
                          setEditImageValue(editingEntry.categoryImage);
                        }
                      }}
                    />
                    <span style={{ fontSize: "14px" }}>
                      Mark as tricky (use category image:{" "}
                      <strong>{editingEntry.categoryImage}</strong>)
                    </span>
                  </label>
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={cancelEdit}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: "white",
                  color: "#333",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveImageEdit}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  backgroundColor: "#28a745",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <h3>To-dos</h3>
      <ul>
        <li>Show tricky only</li>
      </ul>
    </div>
  );
}
