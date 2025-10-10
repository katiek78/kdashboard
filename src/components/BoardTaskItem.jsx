import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faClock } from "@fortawesome/free-solid-svg-icons";
import RepeatBadge from "./RepeatBadge";
import styles from "./BoardTaskItem.module.css";

const BoardTaskItem = ({ task, onPlay, onComplete }) => {
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
      className={`${styles.taskItem} ${task.urgent ? styles.urgent : ""} ${
        task.blocked ? styles.blocked : ""
      }`}
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
        </div>
        {task.repeat && <RepeatBadge repeat={task.repeat} />}
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
