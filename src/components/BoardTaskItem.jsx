import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faClock, faRepeat } from "@fortawesome/free-solid-svg-icons";
import styles from "./BoardTaskItem.module.css";

const BoardTaskItem = ({ task, onPlay }) => {
  const handlePlay = (e) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(task.id);
    }
  };

  return (
    <div
      className={`${styles.taskItem} ${task.urgent ? styles.urgent : ""} ${
        task.blocked ? styles.blocked : ""
      }`}
    >
      <div className={styles.taskHeader}>
        <span className={styles.taskTitle}>{task.title}</span>
        {task.repeat && (
          <FontAwesomeIcon
            icon={faRepeat}
            className={styles.repeatIcon}
            title={`Repeats: ${task.repeat}`}
          />
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
