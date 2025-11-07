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
    setHoverImage(null);
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
              settings.showImageOnHover ? styles.hoverable : ""
            }`}
            onMouseEnter={(e) => handleMouseEnter(group, e)}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
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
        <button onClick={handlePhaseComplete} className={styles.skipButton}>
          Skip to Recall
        </button>
      )}

      {hoverImage && (
        <div
          className={styles.hoverImageOverlay}
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
          }}
        >
          <div className={styles.hoverText}>{hoverImage}</div>
        </div>
      )}
    </div>
  );
}
