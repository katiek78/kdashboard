"use client";

import styles from "./years.module.css";
import CityNameEditor from "../../../components/CityNameEditor";
import MonthLocationModal from "../../../components/MonthLocationModal";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  fetchYearIdFromYear,
  fetchYearMonthLocations,
  upsertYearMonthLocation,
} from "../../../utils/calendarUtils.mjs";
import Link from "next/link";

export default function YearPage() {
  const params = useParams();
  const year = params.year;
  const [yearId, setYearId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monthsData, setMonthsData] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
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

  useEffect(() => {
    setLoading(true);
    fetchYearIdFromYear(Number(year)).then((id) => {
      setYearId(id);
      setLoading(false);
      if (id) {
        fetchYearMonthLocations(id).then((data) => {
          setMonthsData(data);
        });
      } else {
        setMonthsData([]);
      }
    });
  }, [year]);

  // Helper to get month data by number
  const getMonthData = (monthNumber) => {
    return (
      monthsData.find((m) => m.month_number === monthNumber) || {
        month_number: monthNumber,
        month_name: months[monthNumber - 1],
        location_view: "",
        description: "",
      }
    );
  };

  const handleEdit = (monthNumber) => {
    setSelectedMonth(getMonthData(monthNumber));
    setModalOpen(true);
  };

  const handleSave = async (data) => {
    if (!yearId) return;
    await upsertYearMonthLocation({
      ...data,
      year_id: yearId,
    });
    // Refresh months data
    const updated = await fetchYearMonthLocations(yearId);
    setMonthsData(updated);
  };

  return (
    <div className={styles.container}>
      <Link href="/calendar-locations" className={styles.backLink}>
        ← Back to Calendar Locations
      </Link>
      <h2 className={styles.title}>Year: {year}</h2>
      <CityNameEditor year={year} />
      {loading ? (
        <div>Loading year data...</div>
      ) : yearId ? null : (
        <div style={{ color: "red" }}>Year not found in database.</div>
      )}
      <ul className={styles.monthList}>
        {months.map((month, idx) => {
          const monthNumber = idx + 1;
          const monthData = getMonthData(monthNumber);
          return (
            <li key={month} className={styles.monthItem}>
              <span style={{ fontWeight: 500, fontSize: '1.08rem' }}>{month}</span>
              <button
                className={styles.monthEditBtn}
                onClick={() => handleEdit(monthNumber)}
                type="button"
                title="Edit month location"
              >
                <span role="img" aria-label="Edit">✏️</span>
              </button>
              {monthData.location_view && (
                <div className={styles.monthLocationPreview}>
                  <span style={{ color: '#1976d2', fontSize: 15, marginRight: 4 }}>📍</span>
                  {(() => {
                    const val = monthData.location_view.trim();
                    if (val.includes('/embed?')) {
                      return (
                        <iframe
                          src={val}
                          width="100%"
                          height="120"
                          style={{ border: 0, marginTop: 4, marginBottom: 4, borderRadius: 6, maxWidth: 320 }}
                          allowFullScreen=""
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Google Street View Preview"
                        ></iframe>
                      );
                    }
                    if (val.startsWith('https://goo.gl/maps/')) {
                      return (
                        <a href={val} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                      );
                    }
                    if (!val.startsWith('http')) {
                      const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val)}`;
                      return (
                        <a href={searchUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                      );
                    }
                    return (
                      <a href={val} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                    );
                  })()}
                </div>
              )}
              {monthData.description && (
                <div className={styles.monthLocationDescription}>{monthData.description}</div>
              )}
            </li>
          );
        })}
      </ul>
      <MonthLocationModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedMonth(null);
        }}
        monthData={selectedMonth}
        onSave={async (data) => {
          await handleSave(data);
          setModalOpen(false);
          setSelectedMonth(null);
        }}
      />
    </div>
  );
}
