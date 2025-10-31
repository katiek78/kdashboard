"use client";

import styles from "./CalendarYears.module.css";

export default function CalendarYears() {
  // Generate a range of years (you can adjust this range as needed)
  const currentYear = new Date().getFullYear();
  const years = [];

  // Generate years from 1900 to current year + 10
  for (let year = 1900; year <= currentYear + 10; year++) {
    years.push(year);
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Years</h3>
      <div className={styles.grid}>
        {years.map((year) => (
          <div key={year} className={styles.item}>
            {year}
          </div>
        ))}
      </div>
    </div>
  );
}
