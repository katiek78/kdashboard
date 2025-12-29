"use client";

import styles from "./CalendarYears.module.css";
import { useRouter } from "next/navigation";
import useCalendarYearCities from "./useCalendarYearCities";

import { useState } from "react";

export default function CalendarYears() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [century, setCentury] = useState(Math.floor(currentYear / 100) * 100);
  const centuries = [];
  for (let c = 1500; c <= 2100; c += 100) centuries.push(c);
  const start = century;
  const count = 100;
  const years = [];
  for (let year = start; year <= start + 99; year++) years.push(year);
  const { cityMap } = useCalendarYearCities({ start, count, currentYear });

  const handlePrevCentury = () => setCentury((c) => c - 100);
  const handleNextCentury = () => setCentury((c) => c + 100);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Years</h3>
      <div
        style={{
          marginBottom: 16,
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <button
          onClick={handlePrevCentury}
          aria-label="Previous century"
          style={{
            fontSize: "1.2rem",
            padding: "2px 10px",
            borderRadius: 6,
            border: "1px solid #bbb",
            background: "#fff",
            color: "#1976d2",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ←
        </button>
        {centuries.map((c) => (
          <button
            key={c}
            onClick={() => setCentury(c)}
            style={{
              margin: "0 4px",
              padding: "4px 10px",
              borderRadius: 6,
              border: c === century ? "2px solid #1976d2" : "1px solid #bbb",
              background: c === century ? "#e3f2fd" : "#fff",
              color: c === century ? "#1976d2" : "#333",
              fontWeight: c === century ? 700 : 500,
              cursor: "pointer",
              fontSize: "0.95rem",
              transition: "all 0.15s",
            }}
            aria-label={`Show years for ${c}s`}
          >
            {c}s
          </button>
        ))}
        <button
          onClick={handleNextCentury}
          aria-label="Next century"
          style={{
            fontSize: "1.2rem",
            padding: "2px 10px",
            borderRadius: 6,
            border: "1px solid #bbb",
            background: "#fff",
            color: "#1976d2",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          →
        </button>
      </div>
      <div className={styles.grid}>
        {years.map((year) => (
          <div
            key={year}
            className={
              year === currentYear
                ? `${styles.item} ${styles.currentYear}`
                : styles.item
            }
            onClick={() => router.push(`/years/${year}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                router.push(`/years/${year}`);
            }}
            aria-label={`Go to year ${year}`}
          >
            <div>{year}</div>
            {cityMap[year] && (
              <div className={styles.cityName}>{cityMap[year]}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
