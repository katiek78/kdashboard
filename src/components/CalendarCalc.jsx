import React, { useState } from "react";
import { WEEKDAY_COLORS, WEEKDAY_TEXT_COLORS } from "../utils/coloursUtils";
import { format, addDays } from "date-fns";

// Example date formats
const DATE_FORMATS = [
  { label: "D MMM YYYY", format: "d MMM yyyy" },
  { label: "YYYY-MM-DD", format: "yyyy-MM-dd" },
  { label: "DD/MM/YYYY", format: "dd/MM/yyyy" },
  { label: "MMMM D, YYYY", format: "MMMM d, yyyy" },
  { label: "MM-DD-YYYY", format: "MM-dd-yyyy" },
  { label: "dddd, MMMM D", format: "eeee, MMMM d" },
  // Add more formats as needed
];

// Returns full weekday name (e.g. 'Monday')
function getWeekday(date) {
  return format(date, "eeee");
}

function useIsDarkMode() {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export default function CalendarCalc() {
  const [selectedFormat, setSelectedFormat] = useState(DATE_FORMATS[0].format);
  const [date, setDate] = useState(new Date());
  const [showWeekday, setShowWeekday] = useState(false);

  const formattedDate = format(date, selectedFormat);
  const weekdayIndex = getWeekdayIndex(date);
  const weekdayColor = WEEKDAY_COLORS[weekdayIndex];
  const weekdayTextColor = WEEKDAY_TEXT_COLORS[weekdayIndex];
  const weekdayName = format(date, "eeee");
  const weekdayAbbr = format(date, "eee");

  // Dark mode detection
  const isDarkMode = useIsDarkMode();

  // Responsive: use abbreviation for mobile
  const [isMobile, setIsMobile] = useState(false);
  React.useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 500);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // Map weekday name to index (0=Sunday, ... 6=Saturday)
  function getWeekdayIndex(date) {
    return date.getDay();
  }

  function handleShow() {
    setShowWeekday(true);
  }

  function handleGenerateNew() {
    // Generate a new random date (within reasonable range)
    const start = new Date(2000, 0, 1);
    const end = new Date(2030, 11, 31);
    const diff = end.getTime() - start.getTime();
    const newDate = new Date(start.getTime() + Math.random() * diff);
    setDate(newDate);
    setShowWeekday(false);
  }

  return (
    <>
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
          <div style={{ margin: isMobile ? "1rem 0" : "1.5rem 0" }}>
            <span
              style={{
                fontSize: isMobile ? "1.2rem" : "2rem",
                fontWeight: "bold",
                backgroundColor: weekdayColor,
                color:
                  isDarkMode && weekdayTextColor === "#000"
                    ? "#fff"
                    : weekdayTextColor,
                padding: isMobile ? "0.3rem 0.8rem" : "0.5rem 1.5rem",
                borderRadius: "1rem",
                display: "inline-block",
                boxShadow: isDarkMode
                  ? "0 2px 8px rgba(0,0,0,0.32)"
                  : "0 2px 8px rgba(0,0,0,0.08)",
                minWidth: isMobile ? "4rem" : "8rem",
                textAlign: "center",
                border: isDarkMode ? "1px solid #222" : "none",
              }}
            >
              {isMobile ? weekdayAbbr : weekdayName}
            </span>
          </div>
        )}
        <button
          onClick={handleGenerateNew}
          style={{ fontSize: "1rem", marginTop: "1rem" }}
        >
          Generate New
        </button>
      </div>
    </>
  );
}
