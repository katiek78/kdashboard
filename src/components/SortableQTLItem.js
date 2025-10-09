import React, { useState } from "react";
import styles from "./SortableQTLItem.module.css";
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
import RepeatBadge from "./RepeatBadge.jsx";
import SubtaskList from "./SubtaskList.jsx";

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
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    background: highlight
      ? "#ffe066"
      : rowIndex % 2 === 0
      ? "rgba(0,0,0,0.07)"
      : "transparent",
    boxShadow: highlight ? "0 0 20px 5px #ffe066" : "none",
    border: highlight ? "2px solid #f79533" : "none",
  };

  // All static styles are now in the CSS module

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.qtlRoot}
      {...attributes}
    >
      {isEditing ? (
        <div className={styles.editRow}>
          <input
            type="text"
            value={editValues.title}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, title: e.target.value }))
            }
            className={styles.editInput}
          />
          <input
            type="date"
            value={editValues.next_due || new Date().toISOString().slice(0, 10)}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, next_due: e.target.value }))
            }
            className={styles.editInput}
          />
          <input
            type="text"
            value={editValues.repeat || ""}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, repeat: e.target.value }))
            }
            placeholder="Repeat"
            className={styles.editInputRepeat}
          />
          <div className={styles.editBtnBar}>
            <button onClick={() => onSaveEdit(id)} className={styles.editBtn}>
              Save
            </button>
            <button onClick={onCancelEdit} className={styles.editBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.qtlRowMobile}>
          <span className={styles.qtlTitleRow} {...listeners}>
            {urgent && (
              <FontAwesomeIcon
                icon={faStar}
                style={{ color: "#d00", fontSize: 20, marginRight: 2 }}
                title="High priority"
              />
            )}
            <span className={styles.qtlTitleText}>
              {title}
              {repeat && <RepeatBadge repeat={repeat} />}
            </span>
          </span>
          <div className={styles.qtlBtnbarMobile}>
            <input
              type="checkbox"
              onChange={(e) => {
                console.log(
                  "Checkbox clicked for task:",
                  id,
                  "onComplete exists:",
                  !!onComplete
                );
                e.preventDefault(); // Prevent checkbox from actually checking
                if (onComplete) {
                  onComplete(id);
                } else {
                  console.warn(
                    "onComplete function not provided to SortableQTLItem"
                  );
                }
              }}
              className={styles.qtlTileBtnMobile}
              style={{
                width: 32,
                height: 32,
                borderColor: "#4caf50",
                accentColor: "#4caf50",
                cursor: "pointer",
              }}
              title="Mark as complete"
            />
            <button
              title={urgent ? "Unmark urgent" : "Mark as urgent"}
              onClick={() => onToggleUrgent(id, !urgent)}
              className={
                styles.qtlTileBtnMobile + (urgent ? " " + styles.urgent : "")
              }
              style={
                urgent
                  ? {
                      background: "#d00",
                      color: "#fff",
                      borderColor: "#d00",
                      fontWeight: 700,
                    }
                  : { color: "#d00", fontWeight: 700 }
              }
            >
              !
            </button>
            <button
              title="Edit"
              onClick={() => onEdit(id)}
              className={styles.qtlTileBtnMobile}
              style={{ color: "#333" }}
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
            <button
              title={blocked ? "Unblock task" : "Block task"}
              onClick={() => onToggleBlocked(id, !blocked)}
              className={
                styles.qtlTileBtnMobile + (blocked ? " " + styles.blocked : "")
              }
              style={
                blocked
                  ? { color: "#c00", borderColor: "#c00" }
                  : { color: "#888" }
              }
            >
              <FontAwesomeIcon icon={faBan} />
            </button>
            <button
              title="Play"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(id);
              }}
              className={styles.qtlTileBtnMobile}
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
              className={styles.qtlTileBtnMobile + " " + styles.delete}
              style={{ color: "#c00", borderColor: "#c00" }}
            >
              <FontAwesomeIcon icon={faTrash} size="lg" />
            </button>
          </div>
        </div>
      )}

      {/* Subtasks Section */}
      {!isEditing && (
        <SubtaskList
          parentTaskId={id}
          isExpanded={subtasksExpanded}
          onToggleExpanded={() => setSubtasksExpanded(!subtasksExpanded)}
          canEdit={true}
        />
      )}
    </div>
  );
}

export default SortableQTLItem;
