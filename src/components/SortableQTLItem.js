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
    flexDirection: "column",
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

  // Responsive: row on desktop (buttons right), column on mobile (buttons below)
  const rowWrapStyle = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    flexWrap: "nowrap",
    gap: 4,
  };
  const buttonBarStyle = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 0,
    marginLeft: "auto",
    justifyContent: "flex-end",
  };

  // Only apply tile style on mobile (max-width: 600px)
  // We'll inject a style tag for .qtl-tile-btn-mobile
  const tileButtonStyle = {
    background: "#f5f5f5",
    border: "1px solid #ccc",
    borderRadius: 6,
    minWidth: 32,
    minHeight: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    cursor: "pointer",
    transition: "border 0.2s, box-shadow 0.2s",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
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
        <div className="qtl-row-mobile" style={rowWrapStyle}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}
            {...listeners}
          >
            {urgent && (
              <FontAwesomeIcon
                icon={faStar}
                style={{ color: "#d00", fontSize: 20, marginRight: 2 }}
                title="High priority"
              />
            )}
            <span
              style={{
                overflowWrap: "anywhere",
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                // Fix for mobile: force flex to 1 only
                flexGrow: 1,
                flexShrink: 0,
                flexBasis: "auto",
              }}
            >
              {title}
              {repeat && <RepeatBadge repeat={repeat} />}
            </span>
          </span>
          <div className="qtl-btnbar-mobile" style={buttonBarStyle}>
            <style>{`
              @media (max-width: 600px) {
                .qtl-row-mobile {
                  flex-direction: column !important;
                  align-items: stretch !important;
                  gap: 0 !important;
                }
                .qtl-btnbar-mobile {
                  margin-left: 0 !important;
                  margin-top: 4px !important;
                  justify-content: flex-start !important;
                }
                .qtl-tile-btn-mobile {
                  background: #fff !important;
                  border: 2px solid #bbb !important;
                  border-radius: 12px !important;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.07) !important;
                  min-width: 44px !important;
                  min-height: 44px !important;
                  margin: 2px !important;
                  padding: 4px 10px !important;
                  font-size: 20px !important;
                }
                .qtl-tile-btn-mobile.urgent {
                  background: #d00 !important;
                  color: #fff !important;
                  border-color: #d00 !important;
                }
                .qtl-tile-btn-mobile.blocked {
                  color: #c00 !important;
                  border-color: #c00 !important;
                }
                .qtl-tile-btn-mobile.delete {
                  color: #c00 !important;
                  border-color: #c00 !important;
                }
              }
            `}</style>
            <input
              type="checkbox"
              onChange={() => onComplete && onComplete(id)}
              style={{
                ...tileButtonStyle,
                width: 32,
                height: 32,
                borderColor: "#4caf50",
                accentColor: "#4caf50",
                cursor: "pointer",
              }}
              className="qtl-tile-btn-mobile"
              title="Mark as complete"
            />
            <button
              title={urgent ? "Unmark urgent" : "Mark as urgent"}
              onClick={() => onToggleUrgent(id, !urgent)}
              style={{
                ...tileButtonStyle,
                background: urgent ? "#d00" : "#fff",
                color: urgent ? "#fff" : "#d00",
                borderColor: urgent ? "#d00" : "#bbb",
                fontWeight: 700,
              }}
              className={`qtl-tile-btn-mobile${urgent ? " urgent" : ""}`}
            >
              !
            </button>
            <button
              title="Edit"
              onClick={() => onEdit(id)}
              style={{
                ...tileButtonStyle,
                color: "#333",
              }}
              className="qtl-tile-btn-mobile"
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
            <button
              title={blocked ? "Unblock task" : "Block task"}
              onClick={() => onToggleBlocked(id, !blocked)}
              style={{
                ...tileButtonStyle,
                color: blocked ? "#c00" : "#888",
                borderColor: blocked ? "#c00" : "#bbb",
              }}
              className={`qtl-tile-btn-mobile${blocked ? " blocked" : ""}`}
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
                ...tileButtonStyle,
              }}
              className="qtl-tile-btn-mobile"
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
                ...tileButtonStyle,
                color: "#c00",
                borderColor: "#c00",
              }}
              className="qtl-tile-btn-mobile delete"
            >
              <FontAwesomeIcon icon={faTrash} size="lg" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// RepeatBadge: shows a colored badge for repeat type
function RepeatBadge({ repeat }) {
  if (!repeat) return null;
  const rep = repeat.trim().toLowerCase();
  // Weekday logic (support multiple, e.g. mon+tue+wed)
  const weekdayMap = {
    mon: { label: "M", color: "#e53935" }, // red
    tue: { label: "Tu", color: "#fb8c00" }, // orange
    wed: { label: "W", color: "#757575" }, // gray
    thu: { label: "Th", color: "#43a047" }, // green
    fri: { label: "F", color: "#3949ab" }, // indigo
    sat: { label: "Sa", color: "#8e24aa" }, // violet
    sun: { label: "Su", color: "#757575" }, // gray
  };
  if (
    /^(mon|tue|wed|thu|fri|sat|sun)(\+(mon|tue|wed|thu|fri|sat|sun))*$/.test(
      rep
    )
  ) {
    const days = rep.split("+");
    return (
      <>
        {days.map((d, i) => {
          const info = weekdayMap[d];
          if (!info) return null;
          return (
            <span
              key={d + i}
              style={{
                background: info.color,
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
              {info.label}
            </span>
          );
        })}
      </>
    );
  }
  // Daily/ND logic (e.g. daily, 2d, 3d, 2 days)
  if (rep === "d" || /^\d+\s*(d|day|days)$/.test(rep)) {
    return (
      <span
        style={{
          background: "limegreen", // green
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
  if (/^\d+(st|nd|rd|th)$/.test(rep) || /^\d+m\d{1,2}$/.test(rep)) {
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
