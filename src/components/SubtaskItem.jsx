import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPen,
  faCheck,
  faTimes,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "./SubtaskItem.module.css";

function SubtaskItem({
  subtask,
  onUpdate,
  onDelete,
  onToggleCompleted,
  canEdit = true,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveEdit = async () => {
    if (editTitle.trim() && editTitle !== subtask.title) {
      await onUpdate(subtask.id, { title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(subtask.title);
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.subtaskItem} ${
        subtask.completed ? styles.completed : ""
      }`}
      {...attributes}
    >
      {canEdit && (
        <div className={styles.dragHandle} {...listeners}>
          <FontAwesomeIcon icon={faGripVertical} />
        </div>
      )}

      <div className={styles.checkbox}>
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={(e) => onToggleCompleted(subtask.id, e.target.checked)}
          className={styles.checkboxInput}
        />
      </div>

      <div className={styles.content}>
        {isEditing ? (
          <div className={styles.editContainer}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              className={styles.editInput}
              autoFocus
            />
            <div className={styles.editButtons}>
              <button
                onClick={handleSaveEdit}
                className={`${styles.editButton} ${styles.saveButton}`}
                title="Save"
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
              <button
                onClick={handleCancelEdit}
                className={`${styles.editButton} ${styles.cancelButton}`}
                title="Cancel"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.titleContainer}>
            <span className={styles.title}>{subtask.title}</span>
            {canEdit && (
              <div className={styles.actions}>
                <button
                  onClick={() => setIsEditing(true)}
                  className={styles.actionButton}
                  title="Edit subtask"
                >
                  <FontAwesomeIcon icon={faPen} />
                </button>
                <button
                  onClick={() => onDelete(subtask.id)}
                  className={`${styles.actionButton} ${styles.deleteButton}`}
                  title="Delete subtask"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubtaskItem;
