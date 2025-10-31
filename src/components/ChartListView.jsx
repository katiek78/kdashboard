"use client";
import styles from "./ChartListView.module.css";
import Link from "next/link";
import { useState, useEffect, useCallback, memo } from "react";
import supabase from "../utils/supabaseClient";

// Separate AddForm component to isolate re-renders
const AddForm = memo(({ onSave, onCancel, saving }) => {
  const [newEntry, setNewEntry] = useState({
    title: "",
    artist: "",
    no1date: "",
  });
  const [error, setError] = useState("");

  const handleDateChange = useCallback((e) => {
    setNewEntry((prev) => ({ ...prev, no1date: e.target.value }));
  }, []);

  const handleTitleChange = useCallback((e) => {
    setNewEntry((prev) => ({ ...prev, title: e.target.value }));
  }, []);

  const handleArtistChange = useCallback((e) => {
    setNewEntry((prev) => ({ ...prev, artist: e.target.value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (
      !newEntry.title.trim() ||
      !newEntry.artist.trim() ||
      !newEntry.no1date
    ) {
      setError("Please fill in all fields");
      return;
    }

    try {
      await onSave(newEntry);
      setNewEntry({ title: "", artist: "", no1date: "" });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [newEntry, onSave]);

  return (
    <div className={styles.addForm}>
      <h3>Add New Chart Entry</h3>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.formFields}>
        <input
          type="date"
          value={newEntry.no1date}
          onChange={handleDateChange}
          className={styles.formInput}
          placeholder="Date"
        />
        <input
          type="text"
          value={newEntry.title}
          onChange={handleTitleChange}
          className={styles.formInput}
          placeholder="Song Title"
        />
        <input
          type="text"
          value={newEntry.artist}
          onChange={handleArtistChange}
          className={styles.formInput}
          placeholder="Artist"
        />
      </div>
      <button
        className={styles.saveButton}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Entry"}
      </button>
    </div>
  );
});

AddForm.displayName = "AddForm";

export default function ChartListView() {
  const [chartEntries, setChartEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChartEntries();
  }, []);

  const fetchChartEntries = async () => {
    try {
      let allEntries = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("chart_entries")
          .select("*")
          .order("no1date", { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) {
          setError(`Error fetching chart entries: ${error.message}`);
          return;
        }

        if (data && data.length > 0) {
          allEntries = [...allEntries, ...data];
          from += batchSize;
          hasMore = data.length === batchSize; // Continue if we got a full batch
        } else {
          hasMore = false;
        }
      }

      setChartEntries(allEntries);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = useCallback(async (newEntry) => {
    setSaving(true);
    setError("");

    try {
      // Check if the date already exists
      const { data: existingEntry } = await supabase
        .from("chart_entries")
        .select("no1date")
        .eq("no1date", newEntry.no1date)
        .single();

      if (existingEntry) {
        throw new Error("An entry with this date already exists");
      }

      // Insert the new entry
      const { data, error } = await supabase
        .from("chart_entries")
        .insert([newEntry])
        .select();

      if (error) {
        throw new Error(`Error adding entry: ${error.message}`);
      }

      // Add the new entry to the local state
      setChartEntries((prev) =>
        [data[0], ...prev].sort(
          (a, b) => new Date(b.no1date) - new Date(a.no1date)
        )
      );

      setShowAddForm(false);
    } catch (err) {
      throw err; // Re-throw to let AddForm handle the error display
    } finally {
      setSaving(false);
    }
  }, []);

  const formatDate = (dateString) => {
    try {
      // Handle YYYY-MM-DD format
      const parts = dateString.split("-");
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }

      // Fallback to Date parsing
      const date = new Date(dateString + "T00:00:00");
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (err) {
      return dateString; // Return original if parsing fails
    }
  };

  return (
    <div className={styles.chartListContainer}>
      <div className={styles.header}>
        <Link href="/music/charts" className={styles.backLink}>
          ← Back to Charts
        </Link>
        <h1>UK Chart Number 1s</h1>
        <button
          className={styles.addButton}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "Add Entry"}
        </button>
      </div>

      {showAddForm && (
        <AddForm
          onSave={handleAddEntry}
          onCancel={() => setShowAddForm(false)}
          saving={saving}
        />
      )}

      {loading && (
        <div className={styles.loading}>Loading chart entries...</div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && (
        <div className={styles.chartTable}>
          <div className={styles.tableHeader}>
            <div className={styles.headerCell}>Date</div>
            <div className={styles.headerCell}>Song</div>
            <div className={styles.headerCell}>Artist</div>
          </div>

          <div className={styles.tableBody}>
            {chartEntries.length === 0 ? (
              <div className={styles.noEntries}>
                No chart entries found. Import some data first!
              </div>
            ) : (
              chartEntries.map((entry, index) => (
                <div key={index} className={styles.tableRow}>
                  <div className={styles.tableCell}>
                    {formatDate(entry.no1date)}
                  </div>
                  <div className={styles.tableCell}>{entry.title}</div>
                  <div className={styles.tableCell}>{entry.artist}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
