"use client";

import styles from "./CalendarMonthDays.module.css";

export default function CalendarMonthDays() {
  const days = [];

  // Generate days 1-31
  for (let day = 1; day <= 31; day++) {
    days.push(day);
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Month Days</h3>
      <div className={styles.grid}>
        {days.map((day) => (
          <div key={day} className={styles.item}>
            {day}
          </div>
        ))}
      </div>
    </div>
  );
}
