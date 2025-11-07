"use client";
import React, { useState, useEffect } from "react";
import TrainingSettings from "./TrainingSettings";
import MemorizationPhase from "./MemorizationPhase";
import RecallPhase from "./RecallPhase";
import styles from "./TrainingCoordinator.module.css";

export default function TrainingCoordinator({
  discipline = "numbers",
  title = "Memory Training",
}) {
  const [currentPhase, setCurrentPhase] = useState("settings"); // settings, memorization, recall, results
  const [trainingSettings, setTrainingSettings] = useState({});
  const [trainingData, setTrainingData] = useState([]);
  const [results, setResults] = useState(null);

  // Load saved settings on component mount
  useEffect(() => {
    const savedSettings = loadSettings(discipline);
    if (savedSettings && Object.keys(savedSettings).length > 0) {
      setTrainingSettings(savedSettings);
    }
  }, [discipline]);

  // Save settings to localStorage
  const saveSettings = (settings) => {
    try {
      const key = `trainingSettings_${discipline}`;
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (error) {
      console.warn("Failed to save training settings:", error);
    }
  };

  // Load settings from localStorage
  const loadSettings = (disciplineName) => {
    try {
      const key = `trainingSettings_${disciplineName}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.warn("Failed to load training settings:", error);
      return {};
    }
  };

  // Handle settings changes
  const handleSettingsChange = (newSettings) => {
    setTrainingSettings(newSettings);
    saveSettings(newSettings);
  };

  const generateTrainingData = (settings) => {
    switch (discipline) {
      case "numbers":
        return generateNumbers(settings);
      case "cards":
        return generateCards(settings);
      case "words":
        return generateWords(settings);
      default:
        return [];
    }
  };

  const generateNumbers = (settings) => {
    const amount = settings.amount || 20;
    const numbers = [];
    for (let i = 0; i < amount; i++) {
      numbers.push(Math.floor(Math.random() * 10));
    }
    return numbers;
  };

  const generateCards = (settings) => {
    const suits = ["♠", "♣", "♥", "♦"];
    const values = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ];
    const deckSize = settings.deckSize || 52;

    // Generate full deck
    const fullDeck = [];
    for (const suit of suits) {
      for (const value of values) {
        fullDeck.push({ value, suit });
      }
    }

    // Shuffle and take required amount
    const shuffled = fullDeck.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, deckSize);
  };

  const generateWords = (settings) => {
    const wordLists = {
      random: [
        "apple",
        "mountain",
        "river",
        "book",
        "computer",
        "garden",
        "music",
        "ocean",
        "bridge",
        "candle",
        "forest",
        "window",
        "clock",
        "mirror",
        "telephone",
      ],
      nouns: [
        "cat",
        "house",
        "tree",
        "car",
        "phone",
        "table",
        "chair",
        "door",
        "flower",
        "bird",
        "dog",
        "sun",
        "moon",
        "star",
        "cloud",
      ],
      concrete: [
        "hammer",
        "bicycle",
        "bottle",
        "keyboard",
        "sandwich",
        "camera",
        "backpack",
        "pillow",
        "umbrella",
        "scissors",
        "notebook",
        "pencil",
        "spoon",
        "wallet",
        "glasses",
      ],
    };

    const wordType = settings.wordType || "random";
    const wordCount = settings.wordCount || 10;
    const selectedWords = wordLists[wordType] || wordLists.random;

    const shuffled = selectedWords.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, wordCount);
  };

  const handleStartTraining = (settings) => {
    setTrainingSettings(settings);
    saveSettings(settings);
    const data = generateTrainingData(settings);
    setTrainingData(data);
    setCurrentPhase("memorization");
  };

  const handleMemorizationComplete = () => {
    setCurrentPhase("recall");
  };

  const handleRecallComplete = (finalResults) => {
    setResults(finalResults);
    setCurrentPhase("results");
  };

  const handleRestart = () => {
    setCurrentPhase("settings");
    setTrainingSettings({});
    setTrainingData([]);
    setResults(null);
  };

  const handleNewSession = () => {
    const data = generateTrainingData(trainingSettings);
    setTrainingData(data);
    setResults(null);
    setCurrentPhase("memorization");
  };

  const renderCurrentPhase = () => {
    switch (currentPhase) {
      case "settings":
        return (
          <TrainingSettings
            discipline={discipline}
            onStartTraining={handleStartTraining}
            settings={trainingSettings}
            onSettingsChange={handleSettingsChange}
          />
        );

      case "memorization":
        return (
          <MemorizationPhase
            data={trainingData}
            timeLimit={trainingSettings.memorisationTime || 60}
            onPhaseComplete={handleMemorizationComplete}
            discipline={discipline}
            settings={trainingSettings}
          />
        );

      case "recall":
        return (
          <RecallPhase
            originalData={trainingData}
            timeLimit={trainingSettings.recallTime || 120}
            onPhaseComplete={handleRecallComplete}
            discipline={discipline}
            settings={trainingSettings}
          />
        );

      case "results":
        return (
          <RecallPhase
            originalData={trainingData}
            timeLimit={trainingSettings.recallTime || 120}
            onPhaseComplete={handleRecallComplete}
            discipline={discipline}
            settings={trainingSettings}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.coordinatorContainer}>
      <div className={styles.header}>
        <h1>{title}</h1>
        <div className={styles.phaseIndicator}>
          <div
            className={`${styles.phase} ${
              currentPhase === "settings"
                ? styles.active
                : currentPhase !== "settings"
                ? styles.completed
                : ""
            }`}
          >
            1. Settings
          </div>
          <div
            className={`${styles.phase} ${
              currentPhase === "memorization"
                ? styles.active
                : currentPhase === "recall" || currentPhase === "results"
                ? styles.completed
                : ""
            }`}
          >
            2. Memorize
          </div>
          <div
            className={`${styles.phase} ${
              currentPhase === "recall"
                ? styles.active
                : currentPhase === "results"
                ? styles.completed
                : ""
            }`}
          >
            3. Recall
          </div>
          <div
            className={`${styles.phase} ${
              currentPhase === "results" ? styles.active : ""
            }`}
          >
            4. Results
          </div>
        </div>
      </div>

      <div className={styles.content}>{renderCurrentPhase()}</div>

      {currentPhase === "results" && (
        <div className={styles.actionSection}>
          <button
            onClick={handleNewSession}
            className={styles.newSessionButton}
          >
            New Session (Same Settings)
          </button>
          <button onClick={handleRestart} className={styles.restartButton}>
            Change Settings
          </button>
        </div>
      )}

      {currentPhase !== "settings" && currentPhase !== "results" && (
        <div className={styles.actionSection}>
          <button onClick={handleRestart} className={styles.backButton}>
            ← Back to Settings
          </button>
        </div>
      )}
    </div>
  );
}
