"use client";

import styles from "./CalendarWeekDays.module.css";

export default function CalendarWeekDays() {
  const weekDays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Week Days</h3>
      <div className={styles.grid}>
        {weekDays.map((day, index) => (
          <div key={index} className={styles.item}>
            {day}
          </div>
        ))}
      </div>
    </div>
  );
}
