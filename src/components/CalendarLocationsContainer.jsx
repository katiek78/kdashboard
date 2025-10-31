"use client";

import styles from "./CalendarLocationsContainer.module.css";
import CalendarYears from "./CalendarYears";
import CalendarMonths from "./CalendarMonths";
import CalendarMonthDays from "./CalendarMonthDays";
import CalendarWeekDays from "./CalendarWeekDays";

export default function CalendarLocationsContainer() {
  return (
    <div className={styles.calendarLocationsContainer + " pageContainer"}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Calendar Locations</h2>
        <p className={styles.subtitle}>
          Add locations for years, months and days
        </p>
      </div>

      <div className={styles.content}>
        <CalendarYears />
        <CalendarMonths />
        <CalendarMonthDays />
        <CalendarWeekDays />
      </div>
    </div>
  );
}
