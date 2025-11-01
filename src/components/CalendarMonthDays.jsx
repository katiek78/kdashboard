"use client";

import { useState, useEffect } from "react";
import styles from "./CalendarMonthDays.module.css";
import MonthDayModal from "./MonthDayModal";
import { fetchMonthDays, upsertMonthDay } from "../utils/calendarUtils";

export default function CalendarMonthDays() {
  const [selectedDay, setSelectedDay] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [monthDays, setMonthDays] = useState({});

  useEffect(() => {
    loadMonthDays();
  }, []);

  const loadMonthDays = async () => {
    const data = await fetchMonthDays();
    if (data) {
      const daysMap = {};
      data.forEach((day) => {
        daysMap[day.day_number] = day.object_text || "";
      });
      setMonthDays(daysMap);
    }
  };

  const handleDayClick = (dayNumber) => {
    console.log("Day clicked:", dayNumber);
    setSelectedDay(dayNumber);
    setIsModalOpen(true);
  };

  const handleSaveDay = async (dayNumber, objectText) => {
    const dayData = {
      day_number: dayNumber,
      object_text: objectText,
    };

    try {
      await upsertMonthDay(dayData);
      setMonthDays((prev) => ({
        ...prev,
        [dayNumber]: objectText,
      }));
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving month day:", error);
    }
  };

  const handleModalSave = async (dayData) => {
    await handleSaveDay(dayData.day_number, dayData.object_text);
  };

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
          <button
            key={day}
            className={styles.item}
            onClick={() => handleDayClick(day)}
          >
            <span className={styles.dayNumber}>{day}</span>
            {monthDays[day] && (
              <span className={styles.objectText}>{monthDays[day]}</span>
            )}
          </button>
        ))}
      </div>

      {isModalOpen && (
        <MonthDayModal
          isOpen={isModalOpen}
          dayData={{
            day_number: selectedDay,
            object_text: monthDays[selectedDay] || "",
          }}
          onSave={handleModalSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      {console.log(
        "Modal state - isModalOpen:",
        isModalOpen,
        "selectedDay:",
        selectedDay
      )}
    </div>
  );
}
