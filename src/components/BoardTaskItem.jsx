import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faClock,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import RepeatBadge from "./RepeatBadge";
import styles from "./BoardTaskItem.module.css";

const BoardTaskItem = ({ task, onPlay, onComplete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(task.id);
    }
  };

  const handleComplete = (e) => {
    e.stopPropagation();
    console.log("Board task completion checkbox clicked for task:", task.id);
    if (onComplete) {
      onComplete(task.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.taskItem} ${task.urgent ? styles.urgent : ""} ${
        task.blocked ? styles.blocked : ""
      } ${isDragging ? styles.dragging : ""}`}
    >
      <div className={styles.taskHeader}>
        <div className={styles.taskTitleRow}>
          <input
            type="checkbox"
            onChange={handleComplete}
            className={styles.completeCheckbox}
            title="Mark as complete"
          />
          <span className={styles.taskTitle}>{task.title}</span>
          <button
            className={styles.dragHandle}
            {...attributes}
            {...listeners}
            title="Drag to reorder or move"
          >
            <FontAwesomeIcon icon={faGripVertical} />
          </button>
        </div>
        {task.repeat && (
          <div className={styles.repeatBadgeContainer}>
            <RepeatBadge repeat={task.repeat} />
          </div>
        )}
      </div>

      {task.next_due && (
        <div className={styles.dueDate}>
          <FontAwesomeIcon icon={faClock} />
          <span>
            {new Date(task.next_due).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      )}

      <div className={styles.taskActions}>
        <button
          onClick={handlePlay}
          className={styles.playButton}
          title="Start task"
        >
          <FontAwesomeIcon icon={faPlay} />
        </button>
      </div>
    </div>
  );
};

export default BoardTaskItem;
