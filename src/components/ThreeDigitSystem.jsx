import React from "react";
import styles from "./ThreeDigitSystem.module.css";
import ThreeDigitGrid from "./ThreeDigitGrid";
import EditImageModal from "./EditImageModal";
import { useState, useMemo } from "react";
import { getNumberPhonetics } from "../utils/memTrainingUtils";
import supabase from "../utils/supabaseClient";

export default function ThreeDigitSystem() {
  const [refreshGrid, setRefreshGrid] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [importStatus, setImportStatus] = useState("");

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

  const handleImport = async () => {
    if (!importText.trim()) {
      setImportStatus("Please enter text to import");
      return;
    }

    try {
      setImportStatus("Processing import...");
      const lines = importText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      const imports = [];
      for (const line of lines) {
        const match = line.match(/^(\d{3})\s+(.+)$/);
        if (match) {
          const [, numString, compImage] = match;
          imports.push({ num_string: numString, comp_image: compImage });
        }
      }

      if (imports.length === 0) {
        setImportStatus("No valid entries found. Format: 001 image_name");
        return;
      }

      // Handle duplicates based on overwrite setting
      let finalImports = imports;
      if (!overwrite) {
        const existingNumbers = new Set();
        const { data: existing } = await supabase
          .from("comp_images")
          .select("num_string")
          .in(
            "num_string",
            imports.map((imp) => imp.num_string)
          );
        existing?.forEach((row) => existingNumbers.add(row.num_string));
        finalImports = imports.filter(
          (imp) => !existingNumbers.has(imp.num_string)
        );
      }

      if (finalImports.length === 0) {
        setImportStatus("No new entries to import (all numbers already exist)");
        return;
      }

      const { error } = await supabase
        .from("comp_images")
        .upsert(finalImports, { onConflict: "num_string" });

      if (error) throw error;

      setImportStatus(
        `Successfully imported ${finalImports.length} comp images`
      );
      setRefreshGrid(Date.now());
      setImportText("");
    } catch (error) {
      setImportStatus(`Error importing: ${error.message}`);
    }
  };

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
        const match = line.match(/^(\d{3})\s+(.+)$/);
        if (match) {
          const [, numString, location] = match;
          imports.push({ num_string: numString, location: location });
        }
      }

      if (imports.length === 0) {
        setLocationImportStatus(
          "No valid entries found. Format: 001 location_name"
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
        const match = line.match(/^(\d{3})\s+(.+)$/);
        if (match) {
          const [, numString, person] = match;
          imports.push({ num_string: numString, person: person });
        }
      }

      if (imports.length === 0) {
        setPersonImportStatus(
          "No valid entries found. Format: 001 person_name"
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

  const findDuplicates = async () => {
    setLoadingDuplicates(true);
    try {
      const { data, error } = await supabase
        .from("comp_images")
        .select("num_string, comp_image")
        .not("comp_image", "is", null)
        .neq("comp_image", "")
        .like("num_string", "___");

      if (error) throw error;

      // Group by image value
      const imageGroups = new Map();
      data.forEach((row) => {
        const imageValue = row.comp_image;
        if (!imageGroups.has(imageValue)) {
          imageGroups.set(imageValue, []);
        }
        imageGroups.get(imageValue).push(row.num_string);
      });

      // If including cross-length duplicates, check 4-digit system too
      if (includeCrossLength) {
        const { data: fourDigitData, error: fourDigitError } = await supabase
          .from("comp_images")
          .select("num_string, comp_image")
          .not("comp_image", "is", null)
          .neq("comp_image", "");

        if (fourDigitError) throw fourDigitError;

        fourDigitData.forEach((row) => {
          const imageValue = row.comp_image;
          if (!imageGroups.has(imageValue)) {
            imageGroups.set(imageValue, []);
          }
          imageGroups.get(imageValue).push(row.num_string);
        });
      }

      // Filter to only duplicates (more than 1 number per image)
      const duplicates = Array.from(imageGroups.entries())
        .filter(([, numStrings]) => numStrings.length > 1)
        .map(([imageValue, numStrings]) => ({
          imageValue,
          numStrings: numStrings.sort(),
          count: numStrings.length,
        }))
        .sort((a, b) => b.count - a.count);

      setDuplicatesData(duplicates);
    } catch (error) {
      console.error("Error finding duplicates:", error);
    } finally {
      setLoadingDuplicates(false);
    }
  };

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
        <button onClick={() => setShowImport(true)}>Import Comp Images</button>
        <button onClick={() => setShowLocationImport(true)}>
          Import Locations
        </button>
        <button onClick={() => setShowPersonImport(true)}>Import People</button>
        <button onClick={() => setShowDuplicates(true)}>Find Duplicates</button>
        <button onClick={() => setRefreshGrid(Date.now())}>Refresh Grid</button>
      </div>

      <ThreeDigitGrid
        refresh={refreshGrid}
        onEditClick={handleEditClick}
        onUpdateCallback={setGridUpdateCallback}
      />

      {/* Comp Images Import Modal */}
      {showImport && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Import Comp Images</h3>
            <p>Format: 001 image_name (one per line)</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              cols={50}
              placeholder="001 apple&#10;002 banana&#10;003 cherry"
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

      {/* Location Import Modal */}
      {showLocationImport && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Import Locations</h3>
            <p>Format: 001 location_name (one per line)</p>
            <textarea
              value={locationImportText}
              onChange={(e) => setLocationImportText(e.target.value)}
              rows={10}
              cols={50}
              placeholder="001 New York&#10;002 London&#10;003 Tokyo"
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
            <p>Format: 001 person_name (one per line)</p>
            <textarea
              value={personImportText}
              onChange={(e) => setPersonImportText(e.target.value)}
              rows={10}
              cols={50}
              placeholder="001 Albert Einstein&#10;002 Marie Curie&#10;003 Isaac Newton"
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
                <input
                  type="checkbox"
                  checked={includeCrossLength}
                  onChange={(e) => setIncludeCrossLength(e.target.checked)}
                />
                Include 4-digit system duplicates
              </label>
              <button onClick={findDuplicates} disabled={loadingDuplicates}>
                {loadingDuplicates ? "Searching..." : "Find Duplicates"}
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
                      <strong>"{dup.imageValue}"</strong> ({dup.count} numbers):
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
          onClose={() => setShowEditModal(false)}
          onSave={handleEditSave}
          currentValue={editingEntry?.currentValue || ""}
          title={`Edit Comp Image for ${editingEntry?.numString}`}
        />
      )}
    </div>
  );
}
