import React from "react";
import styles from "./RepeatBadge.module.css";

// RepeatBadge: shows a colored badge for repeat type
function RepeatBadge({ repeat }) {
  if (!repeat) return null;
  const rep = repeat.trim().toLowerCase();
  // Weekday logic (support multiple, e.g. mon+tue+wed)
  const weekdayMap = {
    mon: { label: "M", className: styles.badgeWeekdayMon },
    tue: { label: "Tu", className: styles.badgeWeekdayTue },
    wed: { label: "W", className: styles.badgeWeekdayWed },
    thu: { label: "Th", className: styles.badgeWeekdayThu },
    fri: { label: "F", className: styles.badgeWeekdayFri },
    sat: { label: "Sa", className: styles.badgeWeekdaySat },
    sun: { label: "Su", className: styles.badgeWeekdaySun },
  };
  // e.g. 2sat, 3mon, etc. (every N weeks on weekday)
  const matchNWeekday = rep.match(/^(\d+)(mon|tue|wed|thu|fri|sat|sun)$/);
  if (matchNWeekday) {
    const n = matchNWeekday[1];
    const day = matchNWeekday[2];
    const info = weekdayMap[day];
    if (info) {
      return (
        <span className={`${styles.badge} ${info.className}`} title={repeat}>
          {n}
          {info.label}
        </span>
      );
    }
  }
  if (
    /^(mon|tue|wed|thu|fri|sat|sun)(\+(mon|tue|wed|thu|fri|sat|sun))*$/.test(
      rep
    )
  ) {
    const days = rep.split("+");
    return (
      <>
        {days.map((d, i) => {
          const info = weekdayMap[d];
          if (!info) return null;
          return (
            <span
              key={d + i}
              className={`${styles.badge} ${info.className}`}
              title={repeat}
            >
              {info.label}
            </span>
          );
        })}
      </>
    );
  }
  // Daily/ND logic (e.g. daily, 2d, 3d, 2 days)
  if (rep === "d" || /^\d+\s*(d|day|days)$/.test(rep)) {
    return (
      <span className={`${styles.badge} ${styles.badgeDaily}`} title={repeat}>
        {rep
          .replace(/(day|days)/, "D")
          .replace("daily", "D")
          .toUpperCase()}
      </span>
    );
  }
  // Days of month (e.g. 1st, 15th, 30th)
  if (/^\d+(st|nd|rd|th)$/.test(rep) || /^\d+m\d{1,2}$/.test(rep)) {
    return (
      <span className={`${styles.badge} ${styles.badgeMonth}`} title={repeat}>
        {rep.toUpperCase()}
      </span>
    );
  }
  // Fallback: gray badge
  return (
    <span className={`${styles.badge} ${styles.badgeFallback}`} title={repeat}>
      {rep.toUpperCase()}
    </span>
  );
}

export default RepeatBadge;
