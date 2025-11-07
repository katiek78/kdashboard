"use client";
import React, { useState, useEffect } from "react";
import styles from "./TrainingSettings.module.css";

export default function TrainingSettings({
  discipline = "numbers",
  onStartTraining,
  settings = {},
  onSettingsChange,
}) {
  const [localSettings, setLocalSettings] = useState({
    grouping: settings.grouping || 2,
    amount: settings.amount || 20,
    memorisationTime: settings.memorisationTime || 60,
    recallTime: settings.recallTime || 120,
    ...settings,
  });

  // Update local settings when props change (e.g., when loaded from localStorage)
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setLocalSettings((prevSettings) => ({
        ...prevSettings,
        ...settings,
      }));
    }
  }, [settings]);

  const handleSettingChange = (key, value) => {
    console.log("Setting change:", key, "=", value);
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    if (onSettingsChange) {
      onSettingsChange(newSettings);
    }
  };

  const handleStartTraining = () => {
    if (onStartTraining) {
      onStartTraining(localSettings);
    }
  };

  // Different configuration options based on discipline
  const getSettingsConfig = () => {
    switch (discipline) {
      case "numbers":
        return {
          title: "Numbers Training Settings",
          fields: [
            {
              key: "grouping",
              label: "Number Grouping",
              type: "select",
              options: [
                { value: 1, label: "Single digits" },
                { value: 2, label: "2-digit groups" },
                { value: 3, label: "3-digit groups" },
                { value: 4, label: "4-digit groups" },
              ],
            },
            {
              key: "amount",
              label: "Total Numbers",
              type: "select",
              options: [
                { value: 20, label: "20 numbers" },
                { value: 40, label: "40 numbers" },
                { value: 60, label: "60 numbers" },
                { value: 80, label: "80 numbers" },
                { value: 100, label: "100 numbers" },
              ],
            },
            {
              key: "showImageOnHover",
              label: "Show image on hover?",
              type: "checkbox",
            },
          ],
        };
      case "cards":
        return {
          title: "Card Deck Training Settings",
          fields: [
            {
              key: "deckSize",
              label: "Deck Size",
              type: "select",
              options: [
                { value: 13, label: "13 cards (1 suit)" },
                { value: 26, label: "26 cards (half deck)" },
                { value: 52, label: "52 cards (full deck)" },
              ],
            },
            {
              key: "showSuits",
              label: "Show Suits",
              type: "checkbox",
            },
          ],
        };
      case "words":
        return {
          title: "Word Lists Training Settings",
          fields: [
            {
              key: "wordCount",
              label: "Number of Words",
              type: "select",
              options: [
                { value: 10, label: "10 words" },
                { value: 15, label: "15 words" },
                { value: 20, label: "20 words" },
                { value: 30, label: "30 words" },
              ],
            },
            {
              key: "wordType",
              label: "Word Type",
              type: "select",
              options: [
                { value: "random", label: "Random words" },
                { value: "nouns", label: "Nouns only" },
                { value: "concrete", label: "Concrete nouns" },
              ],
            },
          ],
        };
      default:
        return {
          title: "Training Settings",
          fields: [
            {
              key: "amount",
              label: "Amount",
              type: "select",
              options: [
                { value: 10, label: "10 items" },
                { value: 20, label: "20 items" },
                { value: 30, label: "30 items" },
              ],
            },
          ],
        };
    }
  };

  const config = getSettingsConfig();

  return (
    <div className={styles.settingsContainer}>
      <h2>{config.title}</h2>

      <div className={styles.settingsGrid}>
        {config.fields.map((field) => (
          <div key={field.key} className={styles.settingField}>
            <label htmlFor={field.key} className={styles.label}>
              {field.label}
            </label>

            {field.type === "select" && (
              <select
                id={field.key}
                value={localSettings[field.key]}
                onChange={(e) =>
                  handleSettingChange(
                    field.key,
                    isNaN(e.target.value)
                      ? e.target.value
                      : Number(e.target.value)
                  )
                }
                className={styles.select}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === "checkbox" && (
              <input
                id={field.key}
                type="checkbox"
                checked={localSettings[field.key] || false}
                onChange={(e) =>
                  handleSettingChange(field.key, e.target.checked)
                }
                className={styles.checkbox}
              />
            )}

            {field.type === "number" && (
              <input
                id={field.key}
                type="number"
                value={localSettings[field.key]}
                onChange={(e) =>
                  handleSettingChange(field.key, Number(e.target.value))
                }
                className={styles.input}
                min={field.min}
                max={field.max}
              />
            )}
          </div>
        ))}

        {/* Common time settings for all disciplines */}
        <div className={styles.settingField}>
          <label htmlFor="memorisationTime" className={styles.label}>
            Memorisation Time (seconds)
          </label>
          <select
            id="memorisationTime"
            value={localSettings.memorisationTime}
            onChange={(e) =>
              handleSettingChange("memorisationTime", Number(e.target.value))
            }
            className={styles.select}
          >
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={180}>3 minutes</option>
            <option value={300}>5 minutes</option>
          </select>
        </div>

        <div className={styles.settingField}>
          <label htmlFor="recallTime" className={styles.label}>
            Recall Time (seconds)
          </label>
          <select
            id="recallTime"
            value={localSettings.recallTime}
            onChange={(e) =>
              handleSettingChange("recallTime", Number(e.target.value))
            }
            className={styles.select}
          >
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={180}>3 minutes</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
          </select>
        </div>
      </div>

      <button onClick={handleStartTraining} className={styles.startButton}>
        Start Training
      </button>
    </div>
  );
}
