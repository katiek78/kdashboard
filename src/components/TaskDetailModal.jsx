import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTrash,
  faSave,
  faPlus,
  faGripVertical,
  faCheck,
  faEdit,
  faBan,
  faExclamation,
} from "@fortawesome/free-solid-svg-icons";
import RepeatBadge from "./RepeatBadge";
import styles from "./TaskDetailModal.module.css";

const TaskDetailModal = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onSubtaskAdd,
  onSubtaskUpdate,
  onSubtaskDelete,
  onSubtaskReorder,
}) => {
  const [editedTask, setEditedTask] = useState(task || {});
  const [subtasks, setSubtasks] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);

  useEffect(() => {
    if (task) {
      setEditedTask(task);
      setSubtasks(task.subtasks || []);
    }
  }, [task]);

  const handleSave = () => {
    onSave(editedTask);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this task?")) {
      onDelete(task.id);
      onClose();
    }
  };

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      onSubtaskAdd(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle("");
    }
  };

  const handleSubtaskEdit = (subtaskId, newTitle) => {
    onSubtaskUpdate(subtaskId, { title: newTitle });
    setEditingSubtaskId(null);
  };

  const handleSubtaskComplete = (subtaskId, completed) => {
    onSubtaskUpdate(subtaskId, { completed });
  };

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      action();
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Task Details</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Task Title */}
          <div className={styles.field}>
            <label>Title</label>
            {isEditing ? (
              <input
                type="text"
                value={editedTask.title || ""}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, title: e.target.value })
                }
                className={styles.input}
                autoFocus
              />
            ) : (
              <div className={styles.titleDisplay}>
                <span>{task.title}</span>
                {task.repeat && <RepeatBadge repeat={task.repeat} />}
              </div>
            )}
          </div>

          {/* Task Description */}
          <div className={styles.field}>
            <label>Description</label>
            {isEditing ? (
              <textarea
                value={editedTask.description || ""}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, description: e.target.value })
                }
                className={styles.textarea}
                rows={3}
                placeholder="Add a description..."
              />
            ) : (
              <div className={styles.descriptionDisplay}>
                {task.description || <em>No description</em>}
              </div>
            )}
          </div>

          {/* Task Properties */}
          <div className={styles.propertiesGrid}>
            <div className={styles.property}>
              <label>Due Date</label>
              {isEditing ? (
                <input
                  type="date"
                  value={editedTask.next_due || ""}
                  onChange={(e) =>
                    setEditedTask({
                      ...editedTask,
                      next_due: e.target.value || null,
                    })
                  }
                  className={styles.dateInput}
                />
              ) : (
                <span>
                  {task.next_due
                    ? new Date(task.next_due).toLocaleDateString()
                    : "Not set"}
                </span>
              )}
            </div>

            {task.repeat && (
              <div className={styles.property}>
                <label>Repeat</label>
                <span>{task.repeat}</span>
              </div>
            )}

            <div className={styles.property}>
              <label>Priority</label>
              {isEditing ? (
                <button
                  onClick={() =>
                    setEditedTask({ ...editedTask, urgent: !editedTask.urgent })
                  }
                  className={`${styles.toggleButton} ${
                    editedTask.urgent ? styles.active : ""
                  }`}
                  title="Toggle urgent priority"
                >
                  <FontAwesomeIcon icon={faExclamation} />
                  {editedTask.urgent ? " Urgent" : " Normal"}
                </button>
              ) : (
                <span className={styles.statusDisplay}>
                  {task.urgent && <FontAwesomeIcon icon={faExclamation} />}
                  {task.urgent ? " Urgent" : "Normal"}
                </span>
              )}
            </div>

            <div className={styles.property}>
              <label>Status</label>
              {isEditing ? (
                <button
                  onClick={() =>
                    setEditedTask({
                      ...editedTask,
                      blocked: !editedTask.blocked,
                    })
                  }
                  className={`${styles.toggleButton} ${
                    editedTask.blocked ? styles.active : ""
                  }`}
                  title="Toggle blocked status"
                >
                  <FontAwesomeIcon icon={faBan} />
                  {editedTask.blocked ? " Blocked" : " Active"}
                </button>
              ) : (
                <span className={styles.statusDisplay}>
                  {task.blocked && <FontAwesomeIcon icon={faBan} />}
                  {task.blocked ? " Blocked" : "Active"}
                </span>
              )}
            </div>
          </div>

          {/* Subtasks Section */}
          <div className={styles.subtasksSection}>
            <div className={styles.subtasksHeader}>
              <h3>Subtasks ({subtasks.length})</h3>
            </div>

            {/* Add new subtask */}
            <div className={styles.addSubtask}>
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAddSubtask)}
                placeholder="Add a subtask..."
                className={styles.input}
              />
              <button
                onClick={handleAddSubtask}
                className={styles.addButton}
                disabled={!newSubtaskTitle.trim()}
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>

            {/* Subtasks list */}
            <div className={styles.subtasksList}>
              {subtasks.map((subtask) => (
                <div key={subtask.id} className={styles.subtaskItem}>
                  <div className={styles.subtaskContent}>
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={(e) =>
                        handleSubtaskComplete(subtask.id, e.target.checked)
                      }
                      className={styles.checkbox}
                    />

                    {editingSubtaskId === subtask.id ? (
                      <input
                        type="text"
                        defaultValue={subtask.title}
                        onBlur={(e) =>
                          handleSubtaskEdit(subtask.id, e.target.value)
                        }
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleSubtaskEdit(subtask.id, e.target.value);
                          }
                        }}
                        className={styles.subtaskEditInput}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`${styles.subtaskTitle} ${
                          subtask.completed ? styles.completed : ""
                        }`}
                        onClick={() => setEditingSubtaskId(subtask.id)}
                      >
                        {subtask.title}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onSubtaskDelete(subtask.id)}
                    className={styles.deleteSubtaskButton}
                    title="Delete subtask"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.leftActions}>
            <button onClick={handleDelete} className={styles.deleteButton}>
              <FontAwesomeIcon icon={faTrash} />
              Delete Task
            </button>
          </div>

          <div className={styles.rightActions}>
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button onClick={handleSave} className={styles.saveButton}>
                  <FontAwesomeIcon icon={faSave} />
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className={styles.editButton}
              >
                <FontAwesomeIcon icon={faEdit} />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
