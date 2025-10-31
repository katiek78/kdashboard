"use client";

import { useState, useEffect } from "react";
import styles from "./MonthDayModal.module.css";

export default function MonthDayModal({ isOpen, onClose, dayData, onSave }) {
  const [objectText, setObjectText] = useState("");
  const [saving, setSaving] = useState(false);
  const [inputActive, setInputActive] = useState(false);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen && dayData) {
      setObjectText(dayData.object_text || "");
    }
  }, [isOpen, dayData]);

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
    if (!dayData) return;

    setSaving(true);
    try {
      await onSave({
        day_number: dayData.day_number,
        object_text: objectText.trim() || "",
      });
      onClose();
    } catch (error) {
      console.error("Error saving month day object:", error);
      alert("Error saving object. Please try again.");
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

  if (!isOpen || !dayData) {
    console.log('Modal not rendering - isOpen:', isOpen, 'dayData:', dayData);
    return null;
  }

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            Edit Object for Day {dayData.day_number}
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
            <div className={styles.previewLabel}>Day:</div>
            <div className={styles.preview}>
              <div className={styles.previewDay}>{dayData.day_number}</div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Object Text:</label>
            <textarea
              value={objectText}
              onChange={(e) => setObjectText(e.target.value)}
              className={styles.textarea}
              placeholder="Enter the object for this day..."
              rows={4}
              maxLength={500}
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
            <div className={styles.charCount}>
              {objectText.length}/500 characters
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
