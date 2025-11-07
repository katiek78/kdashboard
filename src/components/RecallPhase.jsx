"use client";
import React, { useState, useEffect } from "react";
import styles from "./RecallPhase.module.css";

export default function RecallPhase({
  originalData = [],
  timeLimit = 120,
  onPhaseComplete,
  discipline = "numbers",
  settings = {},
}) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [isActive, setIsActive] = useState(false);
  const [userInput, setUserInput] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState(null);

  useEffect(() => {
    // Initialize user input when component mounts
    initializeUserInput();
  }, [originalData, discipline]);

  useEffect(() => {
    let interval = null;

    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isActive) {
      handleSubmit();
    }

    return () => clearInterval(interval);
  }, [isActive, timeRemaining]);

  const handleStart = () => {
    setIsActive(true);
    initializeUserInput();
  };

  const initializeUserInput = () => {
    switch (discipline) {
      case "numbers":
        setUserInput(new Array(originalData.length).fill(""));
        break;
      case "cards":
        setUserInput(
          new Array(originalData.length).fill({ value: "", suit: "" })
        );
        break;
      case "words":
        setUserInput(new Array(originalData.length).fill(""));
        break;
      default:
        setUserInput(new Array(originalData.length).fill(""));
    }
  };

  const handleInputChange = (index, value, field = null) => {
    const newInput = [...userInput];
    if (field && typeof newInput[index] === "object") {
      newInput[index] = { ...newInput[index], [field]: value };
    } else {
      newInput[index] = value;
    }
    setUserInput(newInput);
  };

  const handleSubmit = () => {
    setIsActive(false);
    const calculatedResults = calculateResults();
    setResults(calculatedResults);
    if (onPhaseComplete) {
      onPhaseComplete(calculatedResults);
    }
  };

  const calculateResults = () => {
    let correct = 0;
    let total = originalData.length;
    const details = [];

    for (let i = 0; i < total; i++) {
      const original = originalData[i];
      const user = userInput[i];
      let isCorrect = false;

      switch (discipline) {
        case "numbers":
          isCorrect = original.toString() === user.toString();
          break;
        case "cards":
          isCorrect =
            original.value === user.value && original.suit === user.suit;
          break;
        case "words":
          isCorrect = original.toLowerCase() === user.toLowerCase();
          break;
        default:
          isCorrect = original === user;
      }

      if (isCorrect) correct++;

      details.push({
        index: i,
        original,
        user,
        correct: isCorrect,
      });
    }

    return {
      correct,
      total,
      percentage: Math.round((correct / total) * 100),
      details,
      timeUsed: timeLimit - timeRemaining,
    };
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderInputFields = () => {
    switch (discipline) {
      case "numbers":
        return renderNumberInputs();
      case "cards":
        return renderCardInputs();
      case "words":
        return renderWordInputs();
      default:
        return renderGenericInputs();
    }
  };

  const renderNumberInputs = () => {
    const grouping = settings.grouping || 2;
    const groups = Math.ceil(originalData.length / grouping);

    return (
      <div className={styles.inputGrid}>
        {Array.from({ length: groups }, (_, groupIndex) => {
          const startIndex = groupIndex * grouping;
          const endIndex = Math.min(startIndex + grouping, originalData.length);
          const groupValue = userInput.slice(startIndex, endIndex).join("");

          return (
            <div key={groupIndex} className={styles.inputGroup}>
              <label className={styles.inputLabel}>
                Group {groupIndex + 1}
              </label>
              <input
                type="text"
                value={groupValue}
                onChange={(e) => {
                  const value = e.target.value;
                  const newInput = [...userInput];

                  // Clear the current group first
                  for (let i = startIndex; i < endIndex; i++) {
                    newInput[i] = "";
                  }

                  // Fill in the new values
                  for (
                    let i = 0;
                    i < value.length &&
                    i < grouping &&
                    startIndex + i < originalData.length;
                    i++
                  ) {
                    newInput[startIndex + i] = value[i];
                  }

                  setUserInput(newInput);
                }}
                className={styles.input}
                maxLength={grouping}
                placeholder={`${grouping} digits`}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderCardInputs = () => {
    return (
      <div className={styles.inputGrid}>
        {originalData.map((_, index) => (
          <div key={index} className={styles.cardInputGroup}>
            <label className={styles.inputLabel}>Card {index + 1}</label>
            <div className={styles.cardInputs}>
              <input
                type="text"
                value={userInput[index]?.value || ""}
                onChange={(e) =>
                  handleInputChange(index, e.target.value, "value")
                }
                className={styles.cardInput}
                placeholder="Value"
                maxLength={2}
              />
              <input
                type="text"
                value={userInput[index]?.suit || ""}
                onChange={(e) =>
                  handleInputChange(index, e.target.value, "suit")
                }
                className={styles.cardInput}
                placeholder="Suit"
                maxLength={1}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWordInputs = () => {
    return (
      <div className={styles.inputGrid}>
        {originalData.map((_, index) => (
          <div key={index} className={styles.inputGroup}>
            <label className={styles.inputLabel}>{index + 1}.</label>
            <input
              type="text"
              value={userInput[index] || ""}
              onChange={(e) => handleInputChange(index, e.target.value)}
              className={styles.input}
              placeholder="Enter word"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderGenericInputs = () => {
    return (
      <div className={styles.inputGrid}>
        {originalData.map((_, index) => (
          <div key={index} className={styles.inputGroup}>
            <label className={styles.inputLabel}>Item {index + 1}</label>
            <input
              type="text"
              value={userInput[index] || ""}
              onChange={(e) => handleInputChange(index, e.target.value)}
              className={styles.input}
              placeholder="Enter value"
            />
          </div>
        ))}
      </div>
    );
  };

  if (results) {
    return (
      <div className={styles.recallContainer}>
        <div className={styles.resultsSection}>
          <h2>Results</h2>
          <div className={styles.scoreDisplay}>
            <div className={styles.scoreMain}>
              {results.correct} / {results.total}
            </div>
            <div className={styles.scorePercentage}>{results.percentage}%</div>
          </div>

          <div className={styles.resultsDetails}>
            <p>Time used: {formatTime(results.timeUsed)}</p>
            <p>Accuracy: {results.percentage}%</p>
          </div>

          <div className={styles.detailedResults}>
            <h3>Detailed Results</h3>
            <div className={styles.resultsList}>
              {results.details.map((item, index) => (
                <div
                  key={index}
                  className={`${styles.resultItem} ${
                    item.correct ? styles.correct : styles.incorrect
                  }`}
                >
                  <span className={styles.resultIndex}>{index + 1}.</span>
                  <span className={styles.resultOriginal}>
                    {typeof item.original === "object"
                      ? `${item.original.value}${item.original.suit}`
                      : item.original}
                  </span>
                  <span className={styles.resultUser}>
                    {typeof item.user === "object"
                      ? `${item.user.value || "?"}${item.user.suit || "?"}`
                      : item.user || "?"}
                  </span>
                  <span className={styles.resultStatus}>
                    {item.correct ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.recallContainer}>
      <div className={styles.header}>
        <h2>Recall Phase</h2>
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

      {!isActive && (
        <div className={styles.startSection}>
          <p className={styles.instructions}>
            Now try to recall the {discipline} in the correct order. You have{" "}
            {formatTime(timeLimit)} to complete this phase.
          </p>
          <button onClick={handleStart} className={styles.startButton}>
            Start Recall
          </button>
        </div>
      )}

      {isActive && (
        <div className={styles.inputSection}>
          {renderInputFields()}

          <div className={styles.actionButtons}>
            <button onClick={handleSubmit} className={styles.submitButton}>
              Submit Answers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
