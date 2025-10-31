"use client";

import { useState, useEffect } from "react";
import styles from "./MonthColourModal.module.css";

export default function MonthColourModal({
  isOpen,
  onClose,
  monthData,
  onSave,
}) {
  const [colourName, setColourName] = useState("");
  const [colourHex, setColourHex] = useState("");
  const [saving, setSaving] = useState(false);
  const [inputActive, setInputActive] = useState(false);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen && monthData) {
      setColourName(monthData.colour_name || "");
      setColourHex(monthData.colour_hex || "#f0f0f0");
    }
  }, [isOpen, monthData]);

  // Prevent browser back/forward gestures when modal is open
  useEffect(() => {
    if (isOpen) {
      // More aggressive prevention of navigation gestures
      const preventAllNavigation = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      // Prevent keyboard navigation too
      const preventKeyNavigation = (e) => {
        if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
        }
        // Prevent Escape key from closing modal during text selection
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // Add comprehensive event blocking
      window.addEventListener("wheel", preventAllNavigation, {
        passive: false,
        capture: true,
      });
      window.addEventListener("touchstart", preventAllNavigation, {
        passive: false,
        capture: true,
      });
      window.addEventListener("touchmove", preventAllNavigation, {
        passive: false,
        capture: true,
      });
      window.addEventListener("touchend", preventAllNavigation, {
        passive: false,
        capture: true,
      });
      window.addEventListener("gesturestart", preventAllNavigation, {
        passive: false,
        capture: true,
      });
      window.addEventListener("gesturechange", preventAllNavigation, {
        passive: false,
        capture: true,
      });
      window.addEventListener("gestureend", preventAllNavigation, {
        passive: false,
        capture: true,
      });
      window.addEventListener("keydown", preventKeyNavigation, {
        capture: true,
      });

      // Prevent browser back/forward with swipe
      document.body.style.overscrollBehaviorX = "none";
      document.documentElement.style.overscrollBehaviorX = "none";
      document.body.style.touchAction = "none";

      return () => {
        window.removeEventListener("wheel", preventAllNavigation, {
          capture: true,
        });
        window.removeEventListener("touchstart", preventAllNavigation, {
          capture: true,
        });
        window.removeEventListener("touchmove", preventAllNavigation, {
          capture: true,
        });
        window.removeEventListener("touchend", preventAllNavigation, {
          capture: true,
        });
        window.removeEventListener("gesturestart", preventAllNavigation, {
          capture: true,
        });
        window.removeEventListener("gesturechange", preventAllNavigation, {
          capture: true,
        });
        window.removeEventListener("gestureend", preventAllNavigation, {
          capture: true,
        });
        window.removeEventListener("keydown", preventKeyNavigation, {
          capture: true,
        });
        document.body.style.overscrollBehaviorX = "";
        document.documentElement.style.overscrollBehaviorX = "";
        document.body.style.touchAction = "";
      };
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!monthData) return;

    setSaving(true);
    try {
      await onSave({
        month_number: monthData.month_number,
        colour_name: colourName.trim() || null,
        colour_hex: colourHex,
      });
      onClose();
    } catch (error) {
      console.error("Error saving month colour:", error);
      alert("Error saving colour. Please try again.");
    }
    setSaving(false);
  };

  const handleBackdropClick = (e) => {
    // Don't close if input is active
    if (inputActive) return;

    // Only close if the actual backdrop was clicked
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCancel = () => {
    // Don't close if input is active (gesture might be triggering this)
    if (inputActive) return;
    onClose();
  };

  const getMonthName = (monthNumber) => {
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
    return months[monthNumber - 1];
  };

  if (!isOpen || !monthData) return null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            Edit Colour for {getMonthName(monthData.month_number)}
          </h3>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.previewSection}>
            <div className={styles.previewLabel}>Preview:</div>
            <div className={styles.preview}>
              <div className={styles.previewMonth}>
                {getMonthName(monthData.month_number)}
              </div>
              <div
                className={styles.previewStripe}
                style={{ backgroundColor: colourHex }}
              ></div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Colour Name (optional):</label>
            <input
              type="text"
              value={colourName}
              onChange={(e) => setColourName(e.target.value)}
              className={styles.input}
              placeholder="e.g. Spring Green, Winter Blue..."
              maxLength={50}
              onFocus={() => setInputActive(true)}
              onBlur={() => setInputActive(false)}
              onMouseDown={() => setInputActive(true)}
              onMouseUp={() => setTimeout(() => setInputActive(false), 100)}
              onWheel={(e) => e.stopPropagation()}
              onTouchStart={(e) => {
                setInputActive(true);
                e.stopPropagation();
              }}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => {
                e.stopPropagation();
                setTimeout(() => setInputActive(false), 100);
              }}
              style={{ touchAction: "manipulation" }}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Colour Hex:</label>
            <div className={styles.colourInputGroup}>
              <input
                type="color"
                value={colourHex}
                onChange={(e) => setColourHex(e.target.value)}
                className={styles.colourPicker}
              />
              <input
                type="text"
                value={colourHex}
                onChange={(e) => setColourHex(e.target.value)}
                className={styles.hexInput}
                pattern="^#[0-9A-Fa-f]{6}$"
                placeholder="#000000"
                onWheel={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{ touchAction: "manipulation" }}
              />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={saving}
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
