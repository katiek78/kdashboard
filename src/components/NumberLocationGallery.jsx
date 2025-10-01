// Synchronous helper to get the display name for a level
// For level 1 returns 'World', otherwise returns a Promise for the location string
export function getLevelName(level, startingDigits) {
  if (level === 1) return "World";
  return getLocForLevel(level, startingDigits);
}
import React, { useState, useEffect } from "react";
import styles from "./NumberLocationGallery.module.css";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchNumLoc } from "../utils/numLocUtils";

// Helper to get the numbers for the current level and startingDigits
function getTileNumbers(level, startingDigits) {
  if (level === 1) {
    return Array.from({ length: 10 }, (_, i) => i);
  }
  const start = startingDigits * 10;
  return Array.from({ length: 10 }, (_, i) => start + i);
}

// Returns the location for the current group (e.g., for 170-179, looks up number_string '17')
export async function getLocForLevel(lvl, startingDigits) {
  // The number_string to look up is the startingDigits as a string, padded if needed
  const numString = startingDigits.toString().padStart(lvl - 1, "0");
  const data = await fetchNumLoc(numString);
  return data && data.location ? data.location : "";
}

const NumberLocationGallery = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read level/startingDigits from query params if present
  const initialLevel = parseInt(searchParams.get("level") || "1", 10);
  const initialStartingDigits = parseInt(
    searchParams.get("startingDigits") || "0",
    10
  );
  const [level, setLevel] = useState(initialLevel);
  const [startingDigits, setStartingDigits] = useState(initialStartingDigits);
  const [groupLocation, setGroupLocation] = useState("");

  // If query params change, update state
  useEffect(() => {
    setLevel(initialLevel);
    setStartingDigits(initialStartingDigits);
    // eslint-disable-next-line
  }, [initialLevel, initialStartingDigits]);

  const numbers = getTileNumbers(level, startingDigits);

  // Handler for tile click: go to next level with new startingDigits
  const handleTileClick = (num) => {
    setLevel(level + 1);
    setStartingDigits(num);
  };

  // Handler for number click: in future, go to number detail page
  const handleNumberClick = (e, num) => {
    e.stopPropagation();
    // Always treat as string and pad with leading zeros to match level
    const numString = num.toString().padStart(level, "0");
    router.push(`/number-locations/${numString}`);
  };

  // Handler to go back a level
  const handleBack = () => {
    if (level > 1) {
      setLevel(level - 1);
      setStartingDigits(Math.floor(startingDigits / 10));
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchLoc() {
      if (level === 1) {
        setGroupLocation("World");
      } else {
        const loc = await getLocForLevel(level, startingDigits);
        if (!ignore) {
          if (loc) {
            setGroupLocation(loc);
          } else {
            // Compute the range label, e.g. '00-09', '170-179'
            const start = startingDigits * 10;
            const end = start + 9;
            const pad = (n) => n.toString().padStart(level, "0");
            setGroupLocation(`${pad(start)}-${pad(end)}`);
          }
        }
      }
    }
    fetchLoc();
    return () => {
      ignore = true;
    };
  }, [level, startingDigits]);

  // Handler for random number navigation
  const handleRandomNumber = () => {
    const digits = Math.floor(Math.random() * 4) + 1;
    const max = Math.pow(10, digits) - 1;
    const min = digits === 1 ? 0 : Math.pow(10, digits - 1);
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    const numString = n.toString().padStart(digits, "0");
    router.push(`/number-locations/${numString}`);
  };

  return (
    <div className={styles.galleryContainer + " pageContainer"}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 8,
          flexWrap: "wrap",
          padding: "0 8px",
        }}
      >
        <button
          onClick={handleBack}
          disabled={level === 1}
          style={{
            fontSize: 18,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#eee",
            color: "#333",
            cursor: level === 1 ? "not-allowed" : "pointer",
          }}
        >
          Back
        </button>
        <div style={{ fontWeight: "bold", fontSize: 20 }}>{groupLocation}</div>
        <button
          onClick={handleRandomNumber}
          style={{
            fontSize: 18,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#008080",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Random Number
        </button>
      </div>
      <div className={styles.tilesGrid}>
        {numbers.map((num) => (
          <div
            key={num}
            className={styles.tile}
            onClick={() => handleTileClick(num)}
            tabIndex={0}
            style={{ cursor: "pointer" }}
          >
            <span
              className={styles.tileNumber}
              onClick={(e) => handleNumberClick(e, num)}
              style={{
                fontSize: 48,
                fontWeight: "bold",
                display: "block",
                marginBottom: 8,
                color: "#004d4d",
              }}
              tabIndex={-1}
            >
              {num.toString().padStart(level, "0")}
            </span>
            {/* Placeholder for future tile content */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NumberLocationGallery;
