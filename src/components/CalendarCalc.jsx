import React, { useState } from "react";
import { WEEKDAY_COLORS, WEEKDAY_TEXT_COLORS } from "../utils/coloursUtils";
import { format } from "date-fns";
import styles from "./CalendarCalc.module.css";

// Example date formats
const DATE_FORMATS = [
  { label: "D MMM YYYY", format: "d MMM yyyy" },
  { label: "MMMM D, YYYY", format: "MMMM d, yyyy" },
  { label: "YYYY-MM-DD", format: "yyyy-MM-dd" },
  { label: "DD/MM/YYYY", format: "dd/MM/yyyy" },
  { label: "MM-DD-YYYY", format: "MM-dd-yyyy" },
  // Add more formats as needed
];

export default function CalendarCalc() {
  const [showRange, setShowRange] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(DATE_FORMATS[0].format);
  const [date, setDate] = useState(() => {
    const start = new Date(2000, 0, 1);
    const end = new Date(2030, 11, 31);
    const diff = end.getTime() - start.getTime();
    return new Date(start.getTime() + Math.random() * diff);
  });
  const [showWeekday, setShowWeekday] = useState(false);
  const [startYear, setStartYear] = useState(1600);
  const [endYear, setEndYear] = useState(2099);

  function getRandomDate(startY, endY) {
    const start = new Date(startY, 0, 1);
    const end = new Date(endY, 11, 31);
    const diff = end.getTime() - start.getTime();
    return new Date(start.getTime() + Math.random() * diff);
  }

  const formattedDate = format(date, selectedFormat);
  const weekdayIndex = getWeekdayIndex(date);
  const weekdayColor = WEEKDAY_COLORS[weekdayIndex];
  const weekdayName = format(date, "eeee");

  // Map weekday name to index (0=Sunday, ... 6=Saturday)
  function getWeekdayIndex(date) {
    return date.getDay();
  }

  function handleShow() {
    setShowWeekday(true);
  }

  function handleGenerateNew() {
    const newDate = getRandomDate(startYear, endYear);
    setDate(newDate);
    setShowWeekday(false);
  }

  return (
    <>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <button
          className={styles.calendarCalcRangeToggle}
          onClick={() => setShowRange((v) => !v)}
        >
          {showRange ? "Hide Range Settings" : "Show Range Settings"}
        </button>
        {showRange && (
          <div className={styles.calendarCalcRangeInputs}>
            <div className={styles.calendarCalcRangeInput}>
              <label htmlFor="calendarCalcStartYear">Start Year:</label>
              <input
                id="calendarCalcStartYear"
                type="number"
                value={startYear}
                min={1000}
                max={endYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
              />
            </div>
            <div className={styles.calendarCalcRangeInput}>
              <label htmlFor="calendarCalcEndYear">End Year:</label>
              <input
                id="calendarCalcEndYear"
                type="number"
                value={endYear}
                min={startYear}
                max={3000}
                onChange={(e) => setEndYear(Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
        >
          {DATE_FORMATS.map((opt) => (
            <option key={opt.format} value={opt.format}>
              {opt.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: "3rem", margin: "2rem 0" }}>
          {formattedDate}
        </div>
        {!showWeekday && (
          <button
            onClick={handleShow}
            style={{ fontSize: "1.2rem", padding: "0.5rem 2rem" }}
          >
            Show
          </button>
        )}
        {showWeekday && (
          <div>
            <span
              className={styles.calendarCalcBadge}
              style={{
                backgroundColor: weekdayColor,
                color:
                  weekdayIndex === 3
                    ? "#000"
                    : WEEKDAY_TEXT_COLORS[weekdayIndex],
              }}
            >
              {weekdayName}
            </span>
          </div>
        )}
        <div>
          <button
            onClick={handleGenerateNew}
            style={{ fontSize: "1rem", marginTop: "1rem" }}
          >
            Generate New
          </button>
        </div>
      </div>
    </>
  );
}
