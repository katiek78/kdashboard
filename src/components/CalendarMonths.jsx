"use client";

import styles from "./CalendarMonths.module.css";

export default function CalendarMonths() {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Months</h3>
      <div className={styles.grid}>
        {months.map((month, index) => (
          <div key={index} className={styles.item}>
            {month}
          </div>
        ))}
      </div>
    </div>
  );
}
