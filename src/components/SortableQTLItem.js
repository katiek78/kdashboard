import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPlay,
  faBan,
  faPen,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableQTLItem({
  id,
  title,
  next_due,
  repeat,
  blocked,
  urgent,
  onDelete,
  onPlay,
  onToggleBlocked,
  onToggleUrgent,
  highlight,
  rowIndex = 0,
  onEdit,
  isEditing,
  editValues,
  setEditValues,
  onSaveEdit,
  onCancelEdit,
  onComplete,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontFamily: "'Patrick Hand', cursive",
    fontSize: "1.5rem",
    background: highlight
      ? "#ffe066"
      : rowIndex % 2 === 0
      ? "rgba(0,0,0,0.07)"
      : "transparent",
    boxShadow: highlight ? "0 0 20px 5px #ffe066" : "none",
    border: highlight ? "2px solid #f79533" : "none",
    padding: 4,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {isEditing ? (
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <input
            type="text"
            value={editValues.title}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, title: e.target.value }))
            }
            style={{ fontSize: "1.1rem", marginRight: 4 }}
          />
          <input
            type="date"
            value={editValues.next_due || new Date().toISOString().slice(0, 10)}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, next_due: e.target.value }))
            }
            style={{ fontSize: "1.1rem", marginRight: 4 }}
          />
          <input
            type="text"
            value={editValues.repeat || ""}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, repeat: e.target.value }))
            }
            placeholder="Repeat"
            style={{ fontSize: "1.1rem", marginRight: 4, width: 90 }}
          />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => onSaveEdit(id)} style={{ marginRight: 2 }}>
              Save
            </button>
            <button onClick={onCancelEdit} style={{ marginRight: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {urgent && (
              <FontAwesomeIcon
                icon={faStar}
                style={{ color: "#d00", fontSize: 20, marginRight: 2 }}
                title="High priority"
              />
            )}
            {title}
            {repeat && <RepeatBadge repeat={repeat} />}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "auto",
              gap: 10,
            }}
          >
            <input
              type="checkbox"
              onChange={() => onComplete && onComplete(id)}
              style={{
                width: 25,
                height: 25,
                marginTop: "8px",
              }}
              title="Mark as complete"
            />
            <button
              title={urgent ? "Unmark urgent" : "Mark as urgent"}
              onClick={() => onToggleUrgent(id, !urgent)}
              style={{
                background: urgent ? "#d00" : "#eee",
                color: urgent ? "#fff" : "#d00",
                border: urgent ? "2px solid #d00" : "1px solid #ccc",
                borderRadius: 6,
                fontWeight: 700,
                padding: "2px 8px",
                cursor: "pointer",
                minWidth: 32,
                minHeight: 32,
              }}
            >
              !
            </button>
            <button
              title="Edit"
              onClick={() => onEdit(id)}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                color: "#333",
                fontSize: 20,
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
            <button
              title={blocked ? "Unblock task" : "Block task"}
              onClick={() => onToggleBlocked(id, !blocked)}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                color: blocked ? "#c00" : "#888",
                fontSize: 20,
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faBan} />
            </button>
            <button
              title="Play"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(id);
              }}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon
                icon={faPlay}
                size="lg"
                style={{ color: "black" }}
              />
            </button>
            <button
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                color: "black",
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faTrash} size="lg" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// RepeatBadge: shows a colored badge for repeat type
function RepeatBadge({ repeat }) {
  if (!repeat) return null;
  const rep = repeat.trim().toLowerCase();
  // Weekday logic
  const weekdayMap = {
    mon: { label: "M", color: "#e53935" }, // red
    tue: { label: "Tu", color: "#fb8c00" }, // orange
    wed: { label: "W", color: "#43a047" }, // lime/green
    thu: { label: "Th", color: "#1e88e5" }, // blue
    fri: { label: "F", color: "#3949ab" }, // indigo
    sat: { label: "Sa", color: "#8e24aa" }, // violet
    sun: { label: "Su", color: "#757575" }, // gray
  };
  const repShort = rep.slice(0, 3);
  if (weekdayMap[repShort]) {
    const { label, color } = weekdayMap[repShort];
    return (
      <span
        style={{
          background: color,
          color: "#fff",
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 14,
          padding: "2px 7px",
          marginLeft: 6,
          letterSpacing: 1,
        }}
        title={repeat}
      >
        {label}
      </span>
    );
  }
  // Daily/ND logic (e.g. daily, 2d, 3d, 2 days)
  if (rep === "d" || /^\d+\s*(d|day|days)$/.test(rep)) {
    return (
      <span
        style={{
          background: "#43a047", // green
          color: "#fff",
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 14,
          padding: "2px 7px",
          marginLeft: 6,
          letterSpacing: 1,
        }}
        title={repeat}
      >
        {rep
          .replace(/(day|days)/, "D")
          .replace("daily", "D")
          .toUpperCase()}
      </span>
    );
  }
  // Days of month (e.g. 1st, 15th, 30th)
  if (/^\d+(st|nd|rd|th)$/.test(rep)) {
    return (
      <span
        style={{
          background: "#1976d2", // blue
          color: "#fff",
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 14,
          padding: "2px 7px",
          marginLeft: 6,
          letterSpacing: 1,
        }}
        title={repeat}
      >
        {rep.toUpperCase()}
      </span>
    );
  }
  // Fallback: gray badge
  return (
    <span
      style={{
        background: "#757575",
        color: "#fff",
        borderRadius: 6,
        fontWeight: 700,
        fontSize: 14,
        padding: "2px 7px",
        marginLeft: 6,
        letterSpacing: 1,
      }}
      title={repeat}
    >
      {rep.toUpperCase()}
    </span>
  );
}

export default SortableQTLItem;
