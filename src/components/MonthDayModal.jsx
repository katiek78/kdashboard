"use client";

import { useState, useEffect } from "react";
import styles from "./MonthDayModal.module.css";

export default function MonthDayModal({ isOpen, onClose, dayData, onSave }) {
  const [objectText, setObjectText] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen && dayData) {
      setObjectText(dayData.object_text || "");
    }
  }, [isOpen, dayData]);

  // Prevent browser back/forward gestures when modal is open
  useEffect(() => {
    if (isOpen) {
      // Only prevent horizontal swipe navigation
      document.body.style.overscrollBehaviorX = "none";
      document.documentElement.style.overscrollBehaviorX = "none";

      return () => {
        document.body.style.overscrollBehaviorX = "";
        document.documentElement.style.overscrollBehaviorX = "";
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
    // Only close if the actual backdrop was clicked
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen || !dayData) {
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
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
