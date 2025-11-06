import React, { useState, useEffect } from "react";

const EditImageModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingEntry, 
  duplicateType 
}) => {
  const [editImageValue, setEditImageValue] = useState("");
  const [markAsTricky, setMarkAsTricky] = useState(false);

  // Update local state when editingEntry changes
  useEffect(() => {
    if (editingEntry) {
      setEditImageValue(editingEntry.currentImage || "");
      setMarkAsTricky(false);
    }
  }, [editingEntry]);

  const handleSave = () => {
    onSave(editImageValue, markAsTricky);
  };

  const handleMarkAsTrickyChange = (e) => {
    const checked = e.target.checked;
    setMarkAsTricky(checked);
    if (checked && editingEntry?.categoryImage) {
      setEditImageValue(editingEntry.categoryImage);
    }
  };

  if (!isOpen || !editingEntry) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          minWidth: "400px",
          maxWidth: "500px",
        }}
      >
        <h3>Edit {duplicateType === "comp" ? "Comp" : "Category"} Image</h3>
        <div style={{ margin: "16px 0" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            Number String: <strong>{editingEntry.numString}</strong>
          </label>
          <label style={{ display: "block", marginBottom: "8px" }}>
            Current Image: <strong>{editingEntry.currentImage}</strong>
          </label>
          <label style={{ display: "block", marginBottom: "8px" }}>
            New Image:
          </label>
          <input
            type="text"
            value={editImageValue}
            onChange={(e) => setEditImageValue(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
            }}
            placeholder="Enter new image name..."
            autoFocus
          />

          {duplicateType === "comp" && editingEntry.categoryImage && (
            <div style={{ marginTop: "12px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={markAsTricky}
                  onChange={handleMarkAsTrickyChange}
                />
                <span style={{ fontSize: "14px" }}>
                  Mark as tricky (use category image:{" "}
                  <strong>{editingEntry.categoryImage}</strong>)
                </span>
              </label>
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "white",
              color: "#333",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: "#28a745",
              color: "white",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditImageModal;