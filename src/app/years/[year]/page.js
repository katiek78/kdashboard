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

  // Normalize the Street View input to store or display as an embed URL
  const normalizeLocationView = (input) => {
    let val = (input || "").trim();
    // If iframe HTML, extract src
    if (val.startsWith("<iframe")) {
      const srcMatch = val.match(/src=["']([^"']+)["']/);
      if (srcMatch && srcMatch[1]) {
        val = srcMatch[1];
      } else {
        return "";
      }
    }
    // If already an embed URL
    if (val.startsWith("https://www.google.com/maps/embed?")) {
      return val;
    }
    // If full Street View URL, extract lat,lng
    if (val.startsWith("https://www.google.com/maps/@")) {
      const match = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        const coords = `${match[1]},${match[2]}`;
        return `https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
          coords
        )}&cbp=11,0,0,0,0&output=svembed`;
      }
    }
    // /place/.../@lat,lng,... URLs
    const placeMatch = val.match(/\/@(\-?\d+\.\d+),(\-?\d+\.\d+)/);
    if (placeMatch) {
      const coords = `${placeMatch[1]},${placeMatch[2]}`;
      return `https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
        coords
      )}&cbp=11,0,0,0,0&output=svembed`;
    }
    // Coordinates in parentheses or plain
    const coordMatch = val.match(
      /^\(?\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)?$/
    );
    if (coordMatch) {
      const coords = `${coordMatch[1]},${coordMatch[3]}`;
      return `https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
        coords
      )}&cbp=11,0,0,0,0&output=svembed`;
    }
    // Fallback: return as is (will be shown as a link)
    return val;
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
              <span style={{ fontWeight: 800, fontSize: "1.08rem" }}>
                {month}
              </span>

              {monthData.location_view && (
                <div className={styles.monthLocationPreview}>
                  {monthData.description && (
                    <div className={styles.monthLocationDescription}>
                      {monthData.description}
                    </div>
                  )}
                  {(() => {
                    const embedUrl = normalizeLocationView(
                      monthData.location_view
                    );
                    if (
                      embedUrl.startsWith(
                        "https://www.google.com/ma  ps/embed?"
                      ) ||
                      embedUrl.includes("output=svembed")
                    ) {
                      return (
                        <iframe
                          src={embedUrl}
                          width="100%"
                          height="120"
                          style={{
                            border: 0,
                            marginTop: 4,
                            marginBottom: 4,
                            borderRadius: 6,
                            maxWidth: 320,
                          }}
                          allowFullScreen=""
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Google Street View Preview"
                        ></iframe>
                      );
                    }
                    // Otherwise, show as a link
                    return (
                      <a
                        href={embedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Google Maps
                      </a>
                    );
                  })()}
                </div>
              )}
              <br />
              <button
                className={styles.monthEditBtn}
                onClick={() => handleEdit(monthNumber)}
                type="button"
                title="Edit month location"
              >
                <span role="img" aria-label="Edit">
                  ✏️
                </span>
              </button>
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
