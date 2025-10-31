"use client";
import styles from "./ChartsView.module.css";
import Link from "next/link";
import { useState } from "react";
import supabase from "../utils/supabaseClient";

export default function ChartsView() {
  const [importData, setImportData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  const handleImport = async () => {
    if (!importData.trim()) {
      setImportResult("Please paste some data to import");
      return;
    }

    setImporting(true);
    setImportResult("");

    try {
      // First, fetch existing dates from the database
      const { data: existingEntries, error: fetchError } = await supabase
        .from("chart_entries")
        .select("no1date");

      if (fetchError) {
        setImportResult(`Error fetching existing data: ${fetchError.message}`);
        setImporting(false);
        return;
      }

      // Create a set of existing dates for quick lookup
      const existingDates = new Set(
        existingEntries.map((entry) => entry.no1date)
      );

      // Parse the tab-separated data
      const lines = importData.trim().split("\n");
      const entries = [];
      const seenDates = new Set();
      let skippedCount = 0;

      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length >= 3) {
          const [dateStr, title, artist] = parts;
          let formattedDate;

          // Handle both DD/MM/YYYY and YYYY-MM-DD formats
          if (dateStr.includes("/")) {
            // DD/MM/YYYY format
            const dateParts = dateStr.split("/");
            if (dateParts.length === 3) {
              const [day, month, year] = dateParts;
              formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
                2,
                "0"
              )}`;
            }
          } else if (
            dateStr.includes("-") &&
            dateStr.match(/^\d{4}-\d{2}-\d{2}$/)
          ) {
            // YYYY-MM-DD format (already correct)
            formattedDate = dateStr;
          }

          // Only add if we have a valid date and it's not a duplicate (both in current batch and existing DB)
          if (
            formattedDate &&
            !seenDates.has(formattedDate) &&
            !existingDates.has(formattedDate)
          ) {
            seenDates.add(formattedDate);
            entries.push({
              title: title.trim(),
              artist: artist.trim(),
              no1date: formattedDate,
            });
          } else if (
            formattedDate &&
            (seenDates.has(formattedDate) || existingDates.has(formattedDate))
          ) {
            skippedCount++;
          }
        }
      }

      if (entries.length === 0) {
        const message =
          skippedCount > 0
            ? `No new entries to import. ${skippedCount} duplicate(s) were skipped.`
            : "No valid entries found. Please check the format.";
        setImportResult(message);
        return;
      }

      // Insert into database
      const { data, error } = await supabase
        .from("chart_entries")
        .insert(entries);

      if (error) {
        setImportResult(`Error: ${error.message}`);
      } else {
        const message =
          skippedCount > 0
            ? `Successfully imported ${entries.length} chart entries! ${skippedCount} duplicate(s) were skipped.`
            : `Successfully imported ${entries.length} chart entries!`;
        setImportResult(message);
        setImportData(""); // Clear the textarea
      }
    } catch (err) {
      setImportResult(`Error parsing data: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={styles.chartsContainer}>
      <div className={styles.header}>
        <Link href="/music" className={styles.backLink}>
          ← Back to Music
        </Link>
        <h1>Charts</h1>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2>Import Chart Data</h2>
          <div className={styles.chartContent}>
            <p>
              Paste chart data in format: DD/MM/YYYY [TAB] Title [TAB] Artist
            </p>
            <textarea
              className={styles.importTextarea}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="08/08/2025	The Subway	Chappell Roan&#10;15/08/2025	Golden	Huntr/X/Ejae/Audrey Nuna/Rei"
              rows={6}
            />
            <button
              className={styles.importButton}
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? "Importing..." : "Import Data"}
            </button>
            {importResult && (
              <div
                className={`${styles.importResult} ${
                  importResult.includes("Error") ? styles.error : styles.success
                }`}
              >
                {importResult}
              </div>
            )}
          </div>
        </div>

        <Link href="/music/charts/list" className={styles.chartLink}>
          <div className={styles.chartCard}>
            <h2>Chart list</h2>
            <div className={styles.chartContent}>
              <p>View the list of UK chart number 1s</p>
            </div>
          </div>
        </Link>

        <div className={styles.chartCard}>
          <h2>Chart test</h2>
          <div className={styles.chartContent}>
            <p>Test yourself on UK chart number 1s</p>
          </div>
        </div>
      </div>
    </div>
  );
}
