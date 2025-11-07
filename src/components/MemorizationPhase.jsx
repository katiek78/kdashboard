"use client";
import React, { useState, useEffect } from "react";
import styles from "./MemorizationPhase.module.css";
import { fetchCompImage } from "@/utils/compImagesUtils";
import { getNumberPhonetics } from "@/utils/memTrainingUtils";

export default function MemorizationPhase({
  data = [],
  timeLimit = 60,
  onPhaseComplete,
  discipline = "numbers",
  settings = {},
}) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [isActive, setIsActive] = useState(false);
  const [hoverImage, setHoverImage] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    let interval = null;

    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      handlePhaseComplete();
    }

    return () => clearInterval(interval);
  }, [isActive, timeRemaining]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isActive) return;

      const grouping = settings.grouping || 2;
      const totalGroups = Math.ceil(data.length / grouping);

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          setSelectedGroupIndex((prev) =>
            prev > 0 ? prev - 1 : totalGroups - 1
          );
          setShowHint(false); // Hide hint when navigating
          break;
        case "ArrowRight":
          event.preventDefault();
          setSelectedGroupIndex((prev) =>
            prev < totalGroups - 1 ? prev + 1 : 0
          );
          setShowHint(false); // Hide hint when navigating
          break;
        case "ArrowUp":
          event.preventDefault();
          // Navigate up by one row (assuming grid layout)
          setSelectedGroupIndex((prev) => {
            const cols = Math.min(6, totalGroups); // Estimate columns
            const newIndex = prev - cols;
            return newIndex >= 0 ? newIndex : prev;
          });
          setShowHint(false); // Hide hint when navigating
          break;
        case "ArrowDown":
          event.preventDefault();
          // Navigate down by one row
          setSelectedGroupIndex((prev) => {
            const cols = Math.min(6, totalGroups);
            const newIndex = prev + cols;
            return newIndex < totalGroups ? newIndex : prev;
          });
          setShowHint(false); // Hide hint when navigating
          break;
        case "h":
        case "H":
          event.preventDefault();
          if (settings.showImageOnHover) {
            setShowHint(true);
            // Auto-hide hint after 3 seconds
            setTimeout(() => setShowHint(false), 3000);
          }
          break;
      }
    };

    if (isActive) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, data.length, settings.grouping]);

  // Show hint for selected group when 'h' key is pressed
  useEffect(() => {
    if (!showHint || !isActive || !settings.showImageOnHover) {
      if (!showHint) {
        setHoverImage(null); // Clear tooltip when not showing hint
      }
      return;
    }

    const grouping = settings.grouping || 2;
    const groupedNumbers = [];

    for (let i = 0; i < data.length; i += grouping) {
      groupedNumbers.push(data.slice(i, i + grouping).join(""));
    }

    if (selectedGroupIndex < groupedNumbers.length) {
      const selectedGroup = groupedNumbers[selectedGroupIndex];
      const phonetics = getNumberPhonetics(selectedGroup);

      // Show tooltip for selected group
      setHoverImage(`(${phonetics})`);

      // Fetch the memory image
      fetchCompImage(selectedGroup)
        .then((imageData) => {
          if (imageData && imageData.comp_image) {
            setHoverImage(`${imageData.comp_image} (${phonetics})`);
          }
        })
        .catch(() => {
          // Keep just phonetics if there's an error
          setHoverImage(`(${phonetics})`);
        });
    }
  }, [
    showHint,
    selectedGroupIndex,
    isActive,
    settings.showImageOnHover,
    data,
    settings.grouping,
  ]);

  const handleStart = () => {
    setIsActive(true);
  };

  const handlePhaseComplete = () => {
    setIsActive(false);
    if (onPhaseComplete) {
      onPhaseComplete();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderData = () => {
    switch (discipline) {
      case "numbers":
        return renderNumbers();
      case "cards":
        return renderCards();
      case "words":
        return renderWords();
      default:
        return <div className={styles.dataDisplay}>{data.join(", ")}</div>;
    }
  };

  const handleMouseEnter = async (numberString, event) => {
    if (!settings.showImageOnHover) return;

    // First, immediately show phonetics while we fetch the image
    const phonetics = getNumberPhonetics(numberString);

    // Show phonetics immediately
    setHoverImage(`(${phonetics})`);
    setHoverPosition({ x: event.clientX, y: event.clientY });
    setShowHint(false); // Clear keyboard hint when using mouse

    try {
      const imageData = await fetchCompImage(numberString);

      if (imageData && imageData.comp_image) {
        const displayText = `${imageData.comp_image} (${phonetics})`;
        setHoverImage(displayText);
      } else {
        // Keep just phonetics if no image is found
        setHoverImage(`(${phonetics})`);
      }
    } catch (error) {
      console.error("Error fetching comp image:", error);
      // Keep just phonetics if there's an error
      setHoverImage(`(${phonetics})`);
    }
  };

  const handleMouseLeave = () => {
    if (!showHint) {
      setHoverImage(null);
    }
  };

  const handleMouseMove = (event) => {
    if (hoverImage) {
      setHoverPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const renderNumbers = () => {
    const grouping = settings.grouping || 2;
    const groupedNumbers = [];

    for (let i = 0; i < data.length; i += grouping) {
      groupedNumbers.push(data.slice(i, i + grouping).join(""));
    }

    return (
      <div className={styles.numbersGrid}>
        {groupedNumbers.map((group, index) => (
          <div
            key={index}
            className={`${styles.numberGroup} ${
              index === selectedGroupIndex ? styles.selected : ""
            }`}
            onMouseEnter={(e) =>
              settings.showImageOnHover && handleMouseEnter(group, e)
            }
            onMouseLeave={
              settings.showImageOnHover ? handleMouseLeave : undefined
            }
            onMouseMove={
              settings.showImageOnHover ? handleMouseMove : undefined
            }
          >
            {group}
          </div>
        ))}
      </div>
    );
  };

  const renderCards = () => {
    return (
      <div className={styles.cardsGrid}>
        {data.map((card, index) => (
          <div key={index} className={styles.card}>
            <span className={styles.cardValue}>{card.value}</span>
            <span className={styles.cardSuit}>{card.suit}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderWords = () => {
    return (
      <div className={styles.wordsGrid}>
        {data.map((word, index) => (
          <div key={index} className={styles.wordItem}>
            <span className={styles.wordNumber}>{index + 1}.</span>
            <span className={styles.word}>{word}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.memorizeContainer}>
      <div className={styles.header}>
        <h2>Memorization Phase</h2>
        <div className={styles.timer}>
          <span
            className={`${styles.timeDisplay} ${
              timeRemaining <= 10 ? styles.urgent : ""
            }`}
          >
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {!isActive && timeRemaining === timeLimit && (
        <div className={styles.startSection}>
          <p className={styles.instructions}>
            You have {formatTime(timeLimit)} to memorize the following{" "}
            {discipline}. Click "Start" when you're ready to begin.
          </p>
          <button onClick={handleStart} className={styles.startButton}>
            Start Memorization
          </button>
        </div>
      )}

      {(isActive || timeRemaining < timeLimit) && (
        <div className={styles.dataContainer}>{renderData()}</div>
      )}

      {timeRemaining === 0 && (
        <div className={styles.completeSection}>
          <h3>Time's up!</h3>
          <p>Memorization phase complete. Get ready for the recall phase.</p>
        </div>
      )}

      {isActive && (
        <div className={styles.controlsSection}>
          <button onClick={handlePhaseComplete} className={styles.skipButton}>
            Skip to Recall
          </button>
          {settings.showImageOnHover && (
            <div className={styles.instructionsText}>
              Use arrow keys to navigate • Press 'H' for hints
            </div>
          )}
        </div>
      )}

      {hoverImage && (
        <div
          className={styles.hoverImageOverlay}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 9999,
          }}
        >
          <div className={styles.hoverText}>{hoverImage}</div>
        </div>
      )}
    </div>
  );
}
