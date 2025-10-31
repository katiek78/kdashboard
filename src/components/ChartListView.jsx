"use client";
import styles from "./ChartListView.module.css";
import Link from "next/link";
import { useState, useEffect } from "react";
import supabase from "../utils/supabaseClient";

export default function ChartListView() {
  const [chartEntries, setChartEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className={styles.chartListContainer}>
      <div className={styles.header}>
        <Link href="/music/charts" className={styles.backLink}>
          ← Back to Charts
        </Link>
        <h1>UK Chart Number 1s</h1>
      </div>

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
