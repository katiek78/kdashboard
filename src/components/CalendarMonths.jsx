"use client";

import { useState, useEffect } from "react";
import styles from "./CalendarMonths.module.css";
import { fetchMonthColours, upsertMonthColour } from "../utils/calendarUtils";
import MonthColourModal from "./MonthColourModal";

export default function CalendarMonths() {
  const [monthsData, setMonthsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const defaultMonths = [
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

  useEffect(() => {
    async function loadMonthColours() {
      setLoading(true);
      try {
        const data = await fetchMonthColours();
        if (data && data.length > 0) {
          setMonthsData(data);
        } else {
          // Use default months if no data from database
          const defaultData = defaultMonths.map((month, index) => ({
            month_number: index + 1,
            month_name: month,
            colour_name: null,
            colour_hex: "#f0f0f0", // Default grey
          }));
          setMonthsData(defaultData);
        }
      } catch (error) {
        console.error("Error loading month colours:", error);
        // Fallback to defaults
        const defaultData = defaultMonths.map((month, index) => ({
          month_number: index + 1,
          month_name: month,
          colour_name: null,
          colour_hex: "#f0f0f0",
        }));
        setMonthsData(defaultData);
      }
      setLoading(false);
    }

    loadMonthColours();
  }, []);

  const handleMonthClick = (month) => {
    setSelectedMonth(month);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedMonth(null);
  };

  const handleSaveColour = async (updatedMonth) => {
    try {
      await upsertMonthColour(updatedMonth);
      
      // Update the local state
      setMonthsData(prevData => 
        prevData.map(month => 
          month.month_number === updatedMonth.month_number 
            ? { ...month, ...updatedMonth }
            : month
        )
      );
    } catch (error) {
      console.error("Error saving month colour:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Months</h3>
        <div className={styles.grid}>
          <div className={styles.loading}>Loading months...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Months</h3>
        <div className={styles.grid}>
          {monthsData.map((month) => (
            <div 
              key={month.month_number} 
              className={styles.item}
              onClick={() => handleMonthClick(month)}
            >
              <div className={styles.monthName}>
                {month.month_name || defaultMonths[month.month_number - 1]}
              </div>
              <div
                className={styles.colourStripe}
                style={{ backgroundColor: month.colour_hex }}
                title={month.colour_name || "Click to edit colour"}
              ></div>
            </div>
          ))}
        </div>
      </div>
      
      <MonthColourModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        monthData={selectedMonth}
        onSave={handleSaveColour}
      />
    </>
  );
}
