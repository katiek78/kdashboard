"use client";
import { useState, useEffect } from "react";
import styles from "./MonthLocationModal.module.css";

export default function MonthLocationModal({
  isOpen,
  onClose,
  monthData,
  onSave,
}) {
  const [locationView, setLocationView] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && monthData) {
      setLocationView(monthData.location_view || "");
      setDescription(monthData.description || "");
    }
  }, [isOpen, monthData]);

  const handleSave = async () => {
    if (!monthData) return;
    setSaving(true);
    try {
      await onSave({
        month_number: monthData.month_number,
        location_view: locationView.trim() || null,
        description: description.trim() || null,
      });
      onClose();
    } catch (error) {
      alert("Error saving location view. Please try again.");
    }
    setSaving(false);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCancel = () => {
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
            Edit Location for {getMonthName(monthData.month_number)}
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
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Google Street View Address or Embed URL:
            </label>
            <input
              type="text"
              value={locationView}
              onChange={(e) => setLocationView(e.target.value)}
              className={styles.input}
              placeholder="Paste Google Street View address or embed URL..."
              maxLength={500}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Description (optional):</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              placeholder="Describe the location or add notes..."
              rows={3}
              maxLength={500}
            />
            <div className={styles.charCount}>
              {description.length}/500 characters
            </div>
          </div>
          {locationView && (
            <div className={styles.previewSection}>
              <label className={styles.label}>Preview:</label>
              <div className={styles.streetViewPreview}>
                {/* If it's a Google Maps embed URL, show iframe, else show link */}
                {locationView.includes("/embed?") ? (
                  <iframe
                    src={locationView}
                    width="300"
                    height="200"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Google Street View Preview"
                  ></iframe>
                ) : (
                  <a
                    href={locationView}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            </div>
          )}
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
