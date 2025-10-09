import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faChevronDown,
  faChevronRight,
  faTasks,
} from "@fortawesome/free-solid-svg-icons";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SubtaskItem from "./SubtaskItem";
import {
  fetchSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtaskCompleted,
  reorderSubtasks,
  getSubtaskCounts,
} from "../utils/subtaskUtils";
import styles from "./SubtaskList.module.css";

function SubtaskList({
  parentTaskId,
  isExpanded,
  onToggleExpanded,
  canEdit = true,
}) {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [counts, setCounts] = useState({ total: 0, completed: 0 });
  const [countsLoaded, setCountsLoaded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch subtasks when component mounts or when expanded
  useEffect(() => {
    if (isExpanded) {
      loadSubtasks();
    }
  }, [parentTaskId, isExpanded]);

  // Only fetch counts when component first mounts or parentTaskId changes
  // Use countsLoaded flag to prevent excessive API calls
  useEffect(() => {
    setCountsLoaded(false); // Reset when parentTaskId changes
  }, [parentTaskId]);

  useEffect(() => {
    if (!countsLoaded) {
      loadCounts();
    }
  }, [parentTaskId, countsLoaded]);

  const loadSubtasks = async () => {
    setLoading(true);
    try {
      const data = await fetchSubtasks(parentTaskId);
      setSubtasks(data);
      setCounts({
        total: data.length,
        completed: data.filter((st) => st.completed).length,
      });
    } catch (error) {
      console.error("Error loading subtasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCounts = async () => {
    try {
      const countsData = await getSubtaskCounts(parentTaskId);
      setCounts(countsData);
      setCountsLoaded(true);
    } catch (error) {
      console.error("Error loading subtask counts:", error);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    try {
      const newSubtask = await createSubtask(parentTaskId, newSubtaskTitle);
      if (newSubtask) {
        setSubtasks((prev) => [...prev, newSubtask]);
        setCounts((prev) => ({ ...prev, total: prev.total + 1 }));
        setNewSubtaskTitle("");
        setShowAddForm(false);
      }
    } catch (error) {
      console.error("Error adding subtask:", error);
    }
  };

  const handleUpdateSubtask = async (subtaskId, updates) => {
    try {
      const updatedSubtask = await updateSubtask(subtaskId, updates);
      if (updatedSubtask) {
        setSubtasks((prev) =>
          prev.map((st) => (st.id === subtaskId ? updatedSubtask : st))
        );
      }
    } catch (error) {
      console.error("Error updating subtask:", error);
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    if (!confirm("Delete this subtask?")) return;

    try {
      const success = await deleteSubtask(subtaskId);
      if (success) {
        const deletedSubtask = subtasks.find((st) => st.id === subtaskId);
        setSubtasks((prev) => prev.filter((st) => st.id !== subtaskId));
        setCounts((prev) => ({
          total: prev.total - 1,
          completed: deletedSubtask?.completed
            ? prev.completed - 1
            : prev.completed,
        }));
      }
    } catch (error) {
      console.error("Error deleting subtask:", error);
    }
  };

  const handleToggleCompleted = async (subtaskId, completed) => {
    try {
      const updatedSubtask = await toggleSubtaskCompleted(subtaskId, completed);
      if (updatedSubtask) {
        setSubtasks((prev) =>
          prev.map((st) => (st.id === subtaskId ? updatedSubtask : st))
        );
        setCounts((prev) => ({
          ...prev,
          completed: completed ? prev.completed + 1 : prev.completed - 1,
        }));
      }
    } catch (error) {
      console.error("Error toggling subtask completed:", error);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = subtasks.findIndex((st) => st.id === active.id);
      const newIndex = subtasks.findIndex((st) => st.id === over.id);

      const newSubtasks = arrayMove(subtasks, oldIndex, newIndex);
      setSubtasks(newSubtasks);

      // Update order in database
      const subtaskIds = newSubtasks.map((st) => st.id);
      await reorderSubtasks(parentTaskId, subtaskIds);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleAddSubtask();
    } else if (e.key === "Escape") {
      setNewSubtaskTitle("");
      setShowAddForm(false);
    }
  };

  return (
    <div className={styles.subtaskList}>
      {/* Toggle Button */}
      <button
        onClick={onToggleExpanded}
        className={styles.toggleButton}
        title={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
      >
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          className={styles.chevron}
        />
        <FontAwesomeIcon icon={faTasks} className={styles.tasksIcon} />
        <span className={styles.count}>
          {counts.total > 0
            ? `${counts.completed}/${counts.total}`
            : "Add subtasks"}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {loading ? (
            <div className={styles.loading}>Loading subtasks...</div>
          ) : (
            <>
              {/* Subtask List */}
              {subtasks.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={subtasks.map((st) => st.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={styles.subtaskItems}>
                      {subtasks.map((subtask) => (
                        <SubtaskItem
                          key={subtask.id}
                          subtask={subtask}
                          onUpdate={handleUpdateSubtask}
                          onDelete={handleDeleteSubtask}
                          onToggleCompleted={handleToggleCompleted}
                          canEdit={canEdit}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className={styles.emptyState}>
                  No subtasks yet. Add one below!
                </div>
              )}

              {/* Add New Subtask */}
              {canEdit && (
                <div className={styles.addSubtaskSection}>
                  {showAddForm ? (
                    <div className={styles.addForm}>
                      <input
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Enter subtask title..."
                        className={styles.addInput}
                        autoFocus
                      />
                      <div className={styles.addButtons}>
                        <button
                          onClick={handleAddSubtask}
                          className={`${styles.addButton} ${styles.saveButton}`}
                          disabled={!newSubtaskTitle.trim()}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAddForm(false);
                            setNewSubtaskTitle("");
                          }}
                          className={`${styles.addButton} ${styles.cancelButton}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className={styles.showAddButton}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Add subtask
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SubtaskList;
