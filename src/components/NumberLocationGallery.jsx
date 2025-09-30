import React, { useState } from "react";
import styles from "./NumberLocationGallery.module.css";
import { useRouter } from "next/navigation";

// Helper to get the numbers for the current level and startingDigits
function getTileNumbers(level, startingDigits) {
  if (level === 1) {
    return Array.from({ length: 10 }, (_, i) => i);
  }
  const start = startingDigits * 10;
  return Array.from({ length: 10 }, (_, i) => start + i);
}

const NumberLocationGallery = () => {
  const [level, setLevel] = useState(1);
  const [startingDigits, setStartingDigits] = useState(0);

  const router = useRouter();

  const numbers = getTileNumbers(level, startingDigits);

  // Handler for tile click: go to next level with new startingDigits
  const handleTileClick = (num) => {
    setLevel(level + 1);
    setStartingDigits(num);
  };

  // Handler for number click: in future, go to number detail page
  const handleNumberClick = (e, num) => {
    e.stopPropagation();
    // Placeholder for navigation to number detail page
    router.push(`/number-locations/${num}`);
  };

  // Handler to go back a level
  const handleBack = () => {
    if (level > 1) {
      setLevel(level - 1);
      setStartingDigits(Math.floor(startingDigits / 10));
    }
  };

  return (
    <div className={styles.galleryContainer + " pageContainer"}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
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
            cursor: level === 1 ? "not-allowed" : "pointer",
          }}
        >
          Back
        </button>
        <div style={{ fontWeight: "bold", fontSize: 20 }}>Level {level}</div>
        <div style={{ width: 80 }}></div>
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
