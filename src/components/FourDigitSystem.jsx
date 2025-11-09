import React from "react";
import styles from "./FourDigitSystem.module.css";
import FourDigitGrid from "./FourDigitGrid";
import EditImageModal from "./EditImageModal";
import { useState, useMemo } from "react";
import { getNumberPhonetics } from "../utils/memTrainingUtils";
import supabase from "../utils/supabaseClient";

export default function FourDigitSystem() {
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

  // Location import state
  const [showLocationImport, setShowLocationImport] = useState(false);
  const [locationImportText, setLocationImportText] = useState("");
  const [locationImportStatus, setLocationImportStatus] = useState("");

  // Person import state
  const [showPersonImport, setShowPersonImport] = useState(false);
  const [personImportText, setPersonImportText] = useState("");
  const [personImportStatus, setPersonImportStatus] = useState("");

  // Duplicate detection state
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateType, setDuplicateType] = useState("comp"); // "comp" or "category"
  const [duplicatesData, setDuplicatesData] = useState([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [includeCrossLength, setIncludeCrossLength] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Callback to update a single entry in the grid without full refresh
  const [gridUpdateCallback, setGridUpdateCallback] = useState(null);

  // Memoize phonetics calculations to avoid expensive recalculations on every render
  const memoizedPhonetics = useMemo(() => {
    const phoneticCache = new Map();
    duplicatesData.forEach((dup) => {
      dup.numStrings.forEach((numString) => {
        if (!phoneticCache.has(numString)) {
          phoneticCache.set(
            numString,
            getNumberPhonetics(numString) || "no phonetics"
          );
        }
      });
    });
    return phoneticCache;
  }, [duplicatesData]);

  // Memoize the duplicates list to prevent re-rendering when modal is open
  const duplicatesList = useMemo(() => {
    if (!showDuplicates || duplicatesData.length === 0) return null;

    return duplicatesData.map((dup, index) => (
      <div
        key={dup.image}
        style={{
          border: "1px solid #ddd",
          padding: 12,
          marginBottom: 8,
          borderRadius: 4,
          backgroundColor: "#f9f9f9",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <strong style={{ fontSize: "16px" }}>
              {dup.image || "(empty)"}
            </strong>
            <span style={{ marginLeft: 8, color: "#666" }}>
              ({dup.numStrings.length} occurrences)
            </span>
          </div>
          <button
            onClick={() => removeDuplicate(dup.image)}
            style={{
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 3,
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: "12px",
            }}
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
                ({memoizedPhonetics.get(numString)})
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
    ));
  }, [duplicatesData, memoizedPhonetics, showDuplicates]);

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

  const handleLocationImport = async () => {
    if (!locationImportText.trim()) {
      setLocationImportStatus("Please enter text to import");
      return;
    }

    try {
      setLocationImportStatus("Processing import...");
      const lines = locationImportText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      const imports = [];
      for (const line of lines) {
        const match = line.match(/^(\d{4})\s+(.+)$/);
        if (match) {
          const [, numString, location] = match;
          imports.push({ num_string: numString, location: location });
        }
      }

      if (imports.length === 0) {
        setLocationImportStatus(
          "No valid entries found. Format: 0001 location_name"
        );
        return;
      }

      // Handle duplicates based on overwrite setting
      let finalImports = imports;
      if (!overwrite) {
        const numbersWithLocations = new Set();
        const { data: existing } = await supabase
          .from("numberstrings")
          .select("num_string, location")
          .in(
            "num_string",
            imports.map((imp) => imp.num_string)
          )
          .not("location", "is", null)
          .neq("location", "");
        existing?.forEach((row) => numbersWithLocations.add(row.num_string));
        finalImports = imports.filter(
          (imp) => !numbersWithLocations.has(imp.num_string)
        );
      }

      if (finalImports.length === 0) {
        setLocationImportStatus(
          "No new entries to import (all numbers already have locations assigned)"
        );
        return;
      }

      const { error } = await supabase
        .from("numberstrings")
        .upsert(finalImports, { onConflict: "num_string" });

      if (error) throw error;

      setLocationImportStatus(
        `Successfully imported ${finalImports.length} locations`
      );
      setRefreshGrid(Date.now());
      setLocationImportText("");
    } catch (error) {
      setLocationImportStatus(`Error importing: ${error.message}`);
    }
  };

  const handlePersonImport = async () => {
    if (!personImportText.trim()) {
      setPersonImportStatus("Please enter text to import");
      return;
    }

    try {
      setPersonImportStatus("Processing import...");
      const lines = personImportText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      const imports = [];
      for (const line of lines) {
        const match = line.match(/^(\d{4})\s+(.+)$/);
        if (match) {
          const [, numString, person] = match;
          imports.push({ num_string: numString, person: person });
        }
      }

      if (imports.length === 0) {
        setPersonImportStatus(
          "No valid entries found. Format: 0001 person_name"
        );
        return;
      }

      // Handle duplicates based on overwrite setting
      let finalImports = imports;
      if (!overwrite) {
        const numbersWithPeople = new Set();
        const { data: existing } = await supabase
          .from("numberstrings")
          .select("num_string, person")
          .in(
            "num_string",
            imports.map((imp) => imp.num_string)
          )
          .not("person", "is", null)
          .neq("person", "");
        existing?.forEach((row) => numbersWithPeople.add(row.num_string));
        finalImports = imports.filter(
          (imp) => !numbersWithPeople.has(imp.num_string)
        );
      }

      if (finalImports.length === 0) {
        setPersonImportStatus(
          "No new entries to import (all numbers already have people assigned)"
        );
        return;
      }

      const { error } = await supabase
        .from("numberstrings")
        .upsert(finalImports, { onConflict: "num_string" });

      if (error) throw error;

      setPersonImportStatus(
        `Successfully imported ${finalImports.length} people`
      );
      setRefreshGrid(Date.now());
      setPersonImportText("");
    } catch (error) {
      setPersonImportStatus(`Error importing: ${error.message}`);
    }
  };

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
    }

    setShowEditModal(true);
  }

  async function saveImageEdit(editImageValue, markAsTricky) {
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

      // Update the grid directly instead of triggering full refresh
      if (gridUpdateCallback) {
        gridUpdateCallback(
          editingEntry.numString,
          duplicateType,
          finalImageValue
        );
      }

      // Close modal
      setShowEditModal(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Error updating image:", error);
    }
  }

  function cancelEdit() {
    setShowEditModal(false);
    setEditingEntry(null);
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

  const handleEditClick = (numString, currentValue) => {
    setEditingEntry({ numString, currentValue });
    setShowEditModal(true);
  };

  const handleEditSave = async (newValue) => {
    if (!editingEntry) return;

    try {
      const { numString } = editingEntry;

      const { error } = await supabase
        .from("comp_images")
        .upsert({ num_string: numString, comp_image: newValue });

      if (error) throw error;

      // Update the grid without full refresh if callback is available
      if (gridUpdateCallback) {
        gridUpdateCallback(numString, "comp", newValue);
      } else {
        setRefreshGrid(Date.now());
      }

      setShowEditModal(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Error saving edit:", error);
      alert("Error saving changes");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button onClick={() => setShowImport(true)}>
          Import Category Images
        </button>
        <button onClick={() => setShowCompImport(true)}>
          Import Comp Images
        </button>
        <button onClick={() => setShowLocationImport(true)}>
          Import Locations
        </button>
        <button onClick={() => setShowPersonImport(true)}>Import People</button>
        <button onClick={() => setShowDuplicates(true)}>Find Duplicates</button>
        <button onClick={() => setRefreshGrid(Date.now())}>Refresh Grid</button>
      </div>

      <FourDigitGrid
        refresh={refreshGrid}
        onEditClick={handleEditClick}
        onUpdateCallback={setGridUpdateCallback}
      />
      {/* Category Images Import Modal */}
      {showImport && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Import Category Images</h3>
            <p>Format: 0001 image_name (one per line)</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              cols={50}
              placeholder="0001 apple&#10;0002 banana&#10;0003 cherry"
            />
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Overwrite existing entries
              </label>
            </div>
            <div className={styles.modalButtons}>
              <button onClick={handleImport}>Import</button>
              <button onClick={() => setShowImport(false)}>Cancel</button>
            </div>
            {importStatus && (
              <div className={styles.status}>{importStatus}</div>
            )}
          </div>
        </div>
      )}

      {/* Comp Images Import Modal */}
      {showCompImport && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Import Comp Images</h3>
            <p>
              Format: 0001 image_name (one per line, supports 2-digit, 3-digit,
              or 4-digit numbers)
            </p>
            <textarea
              value={compImportText}
              onChange={(e) => setCompImportText(e.target.value)}
              rows={10}
              cols={50}
              placeholder="0001 apple&#10;002 banana&#10;12 cherry"
            />
            <div>
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
            <div className={styles.modalButtons}>
              <button onClick={handleCompImport}>Import</button>
              <button onClick={() => setShowCompImport(false)}>Cancel</button>
            </div>
            {compImportStatus && (
              <div className={styles.status}>{compImportStatus}</div>
            )}
          </div>
        </div>
      )}

      {/* Location Import Modal */}
      {showLocationImport && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Import Locations</h3>
            <p>Format: 0001 location_name (one per line)</p>
            <textarea
              value={locationImportText}
              onChange={(e) => setLocationImportText(e.target.value)}
              rows={10}
              cols={50}
              placeholder="0001 New York&#10;0002 London&#10;0003 Tokyo"
            />
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Overwrite existing entries
              </label>
            </div>
            <div className={styles.modalButtons}>
              <button onClick={handleLocationImport}>Import</button>
              <button onClick={() => setShowLocationImport(false)}>
                Cancel
              </button>
            </div>
            {locationImportStatus && (
              <div className={styles.status}>{locationImportStatus}</div>
            )}
          </div>
        </div>
      )}

      {/* Person Import Modal */}
      {showPersonImport && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Import People</h3>
            <p>Format: 0001 person_name (one per line)</p>
            <textarea
              value={personImportText}
              onChange={(e) => setPersonImportText(e.target.value)}
              rows={10}
              cols={50}
              placeholder="0001 Albert Einstein&#10;0002 Marie Curie&#10;0003 Isaac Newton"
            />
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Overwrite existing entries
              </label>
            </div>
            <div className={styles.modalButtons}>
              <button onClick={handlePersonImport}>Import</button>
              <button onClick={() => setShowPersonImport(false)}>Cancel</button>
            </div>
            {personImportStatus && (
              <div className={styles.status}>{personImportStatus}</div>
            )}
          </div>
        </div>
      )}

      {/* Duplicates Modal */}
      {showDuplicates && (
        <div className={styles.modal}>
          <div className={styles.modalContent} style={{ maxWidth: "800px" }}>
            <h3>Find Duplicate Images</h3>
            <div className={styles.duplicateControls}>
              <label>
                Search in:
                <select
                  value={duplicateType}
                  onChange={(e) => setDuplicateType(e.target.value)}
                >
                  <option value="comp">Comp Images</option>
                  <option value="category">Category Images</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={includeCrossLength}
                  onChange={(e) => setIncludeCrossLength(e.target.checked)}
                />
                Include cross-length duplicates
              </label>
              <button onClick={findDuplicates} disabled={loadingDuplicates}>
                {loadingDuplicates
                  ? typeof loadingDuplicates === "string"
                    ? loadingDuplicates
                    : "Searching..."
                  : "Find Duplicates"}
              </button>
            </div>

            {duplicatesData.length > 0 && (
              <div className={styles.duplicatesResults}>
                <h4>
                  Found {duplicatesData.length} duplicate images affecting{" "}
                  {duplicatesData.reduce((sum, dup) => sum + dup.count, 0)}{" "}
                  numbers
                </h4>
                <div className={styles.duplicatesList}>
                  {duplicatesData.map((dup, index) => (
                    <div key={index} className={styles.duplicateGroup}>
                      <strong>"{dup.image}"</strong> ({dup.count} numbers):
                      <div className={styles.numberList}>
                        {dup.numStrings.map((numString) => (
                          <span key={numString} className={styles.numberItem}>
                            {numString}
                            <span className={styles.phonetics}>
                              {memoizedPhonetics.get(numString)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.modalButtons}>
              <button onClick={() => setShowDuplicates(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditImageModal
          isOpen={showEditModal}
          onClose={cancelEdit}
          onSave={saveImageEdit}
          currentValue={editingEntry?.currentValue || ""}
          title={`Edit ${
            duplicateType === "comp" ? "Comp" : "Category"
          } Image for ${editingEntry?.numString}`}
        />
      )}
    </div>
  );
}
