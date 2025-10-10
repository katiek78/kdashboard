import React, { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../utils/supabaseClient";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import BoardTaskItem from "./BoardTaskItem";
import TaskDetailModal from "./TaskDetailModal";
import styles from "./BoardView.module.css";

const BoardView = ({ tasks = [], onTaskUpdate, onTaskComplete }) => {
  const router = useRouter();
  const [activeTask, setActiveTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const playTask = (id) => {
    router.push(`/focus/${id}`);
  };

  const handleTaskComplete = (taskId) => {
    console.log("BoardView handling task completion:", taskId);
    if (onTaskComplete) {
      onTaskComplete(taskId);
    }
  };

  // Modal handlers
  const handleTaskClick = async (task) => {
    try {
      // Fetch subtasks for this task
      const { data: subtasks, error } = await supabase
        .from("subtasks")
        .select("*")
        .eq("parent_task_id", task.id)
        .order("order");

      if (error) throw error;

      // Add subtasks to the task object
      const taskWithSubtasks = { ...task, subtasks: subtasks || [] };

      setSelectedTask(taskWithSubtasks);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching subtasks:", error);
      // Still open modal even if subtasks fail to load
      setSelectedTask({ ...task, subtasks: [] });
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskSave = async (updatedTask) => {
    try {
      const { error } = await supabase
        .from("quicktasks")
        .update({
          title: updatedTask.title,
          description: updatedTask.description,
          next_due: updatedTask.next_due,
          urgent: updatedTask.urgent,
          blocked: updatedTask.blocked,
        })
        .eq("id", updatedTask.id);

      if (error) throw error;

      if (onTaskUpdate) {
        onTaskUpdate();
      }

      handleModalClose();
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task");
    }
  };

  const handleTaskDelete = async (taskId) => {
    try {
      // Delete subtasks first
      const { error: subtaskError } = await supabase
        .from("subtasks")
        .delete()
        .eq("parent_task_id", taskId);

      if (subtaskError) throw subtaskError;

      // Delete the main task
      const { error } = await supabase
        .from("quicktasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      if (onTaskUpdate) {
        onTaskUpdate();
      }

      handleModalClose();
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task");
    }
  };

  const handleSubtaskAdd = async (taskId, title) => {
    try {
      const { error } = await supabase.from("subtasks").insert({
        parent_task_id: taskId,
        title: title,
        completed: false,
        order: Date.now(), // Simple ordering
      });

      if (error) throw error;

      // Refresh subtasks in the modal
      await refreshSelectedTaskSubtasks();

      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error("Error adding subtask:", error);
      alert("Failed to add subtask");
    }
  };

  const handleSubtaskUpdate = async (subtaskId, updates) => {
    try {
      const { error } = await supabase
        .from("subtasks")
        .update(updates)
        .eq("id", subtaskId);

      if (error) throw error;

      // Refresh subtasks in the modal
      await refreshSelectedTaskSubtasks();

      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error("Error updating subtask:", error);
      alert("Failed to update subtask");
    }
  };

  const handleSubtaskDelete = async (subtaskId) => {
    try {
      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) throw error;

      // Refresh subtasks in the modal
      await refreshSelectedTaskSubtasks();

      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error("Error deleting subtask:", error);
      alert("Failed to delete subtask");
    }
  };

  const refreshSelectedTaskSubtasks = async () => {
    if (!selectedTask) return;

    try {
      const { data: subtasks, error } = await supabase
        .from("subtasks")
        .select("*")
        .eq("parent_task_id", selectedTask.id)
        .order("order");

      if (error) throw error;

      setSelectedTask((prev) => ({ ...prev, subtasks: subtasks || [] }));
    } catch (error) {
      console.error("Error refreshing subtasks:", error);
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const draggedTask = tasks.find((t) => t.id === active.id);
    setActiveTask(draggedTask);
    console.log("Drag started for task:", draggedTask?.title);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    // Clear the active task
    setActiveTask(null);

    if (!over) return;

    console.log("Drag ended:", {
      activeId: active.id,
      overId: over.id,
      activeData: active.data.current,
      overData: over.data.current,
    });

    // Extract information about the drag operation
    const draggedTaskId = active.id;
    const draggedTask = tasks.find((t) => t.id === draggedTaskId);

    if (!draggedTask) return;

    // Determine if we're moving between columns or within a column
    const sourceColumnId = active.data.current?.sortable?.containerId;
    const targetColumnId = over.data.current?.sortable?.containerId || over.id;

    console.log(
      "Source column:",
      sourceColumnId,
      "Target column:",
      targetColumnId
    );

    if (sourceColumnId !== targetColumnId) {
      // Moving between columns - update due date
      handleTaskMoveToColumn(draggedTaskId, targetColumnId);
    } else {
      // Reordering within column - update task order
      handleTaskReorder(active, over, sourceColumnId);
    }
  };

  const handleTaskMoveToColumn = async (taskId, targetColumnId) => {
    console.log("Moving task", taskId, "to column", targetColumnId);

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    let newNextDue = null;

    if (targetColumnId === "future") {
      // Moving to future - keep current due date if it's beyond our 10-day view
      const days = generateDays();
      const maxDate = days[days.length - 1].date;
      newNextDue =
        task.next_due && task.next_due > maxDate ? task.next_due : null;
    } else {
      // Moving to a specific day
      newNextDue = targetColumnId;
    }

    console.log("New due date:", newNextDue);

    // Update local state immediately for responsive UI
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, next_due: newNextDue } : t
    );
    onTaskUpdate(updatedTasks);

    // Update database
    try {
      await supabase
        .from("quicktasks")
        .update({ next_due: newNextDue })
        .eq("id", taskId);
      console.log("Task moved successfully");
    } catch (error) {
      console.error("Error moving task:", error);
      // Revert local state on error
      onTaskUpdate(tasks);
    }
  };

  const handleTaskReorder = async (active, over, columnId) => {
    console.log("Reordering task within column", columnId);

    // Get all tasks in this column
    const { tasksByColumn } = distributeTasksToColumns();
    const columnTasks =
      columnId === "future"
        ? distributeTasksToColumns().futureTasks
        : tasksByColumn[columnId] || [];

    const oldIndex = columnTasks.findIndex((task) => task.id === active.id);
    const newIndex = columnTasks.findIndex((task) => task.id === over.id);

    if (oldIndex === newIndex) return;

    // Reorder tasks within the column
    const reorderedTasks = [...columnTasks];
    const [movedTask] = reorderedTasks.splice(oldIndex, 1);
    reorderedTasks.splice(newIndex, 0, movedTask);

    // Update order values
    const updates = reorderedTasks.map((task, index) => ({
      id: task.id,
      order: index + 1,
    }));

    console.log("Reorder updates:", updates);

    // Update local state immediately for smooth UI
    const updatedTasks = tasks.map((task) => {
      const update = updates.find((u) => u.id === task.id);
      return update ? { ...task, order: update.order } : task;
    });
    onTaskUpdate(updatedTasks);

    // Update database with new orders
    try {
      await Promise.all(
        updates.map((update) =>
          supabase
            .from("quicktasks")
            .update({ order: update.order })
            .eq("id", update.id)
        )
      );
      console.log("Task reordering saved successfully");
    } catch (error) {
      console.error("Error reordering tasks:", error);
      // Revert local state on error
      onTaskUpdate(tasks);
    }
  };

  // Generate the next 10 days starting from today
  const generateDays = () => {
    const days = [];
    const today = new Date();

    // Color mapping for weekdays (same as RepeatBadge)
    const weekdayColors = {
      0: "#c71c6c", // Sunday - pink
      1: "#e53935", // Monday - red
      2: "#fb8c00", // Tuesday - orange
      3: "#ffff00", // Wednesday - yellow
      4: "#43a047", // Thursday - green
      5: "#3949ab", // Friday - blue
      6: "#8e24aa", // Saturday - purple
    };

    // Text color mapping (black for yellow, white for others)
    const weekdayTextColors = {
      0: "#fff", // Sunday - white text
      1: "#fff", // Monday - white text
      2: "#fff", // Tuesday - white text
      3: "#000", // Wednesday - black text (yellow background)
      4: "#fff", // Thursday - white text
      5: "#fff", // Friday - white text
      6: "#fff", // Saturday - white text
    };

    for (let i = 0; i < 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD format
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const monthDay = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const weekdayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const headerColor = weekdayColors[weekdayIndex];
      const textColor = weekdayTextColors[weekdayIndex];

      days.push({
        date: dateStr,
        dayName,
        monthDay,
        isToday: i === 0,
        headerColor,
        textColor,
      });
    }

    return days;
  };

  // Distribute tasks to appropriate columns
  const distributeTasksToColumns = () => {
    const days = generateDays();
    const today = new Date().toISOString().slice(0, 10);
    const maxDate = days[days.length - 1].date; // Last day in our 10-day view

    console.log("Board View - Distributing tasks:", tasks.length, "tasks");
    console.log("Today:", today, "MaxDate:", maxDate);

    const tasksByColumn = {};
    const futureTasks = [];

    // Initialize empty arrays for each day
    days.forEach((day) => {
      tasksByColumn[day.date] = [];
    });

    tasks.forEach((task) => {
      // Handle repeating tasks
      if (task.repeat) {
        const rep = task.repeat.trim().toLowerCase();
        // ONLY pure daily tasks (d, daily) always show on today
        // Numbered day tasks (2d, 3d, etc.) should respect their next_due date
        if (rep === "d" || rep === "daily") {
          if (tasksByColumn[today]) {
            tasksByColumn[today].push(task);
          }
          return;
        }
      }

      // For non-daily repeating tasks and one-time tasks, use their next_due date
      if (task.next_due) {
        if (task.next_due <= today) {
          // Tasks due today or in the past go to today's column
          if (tasksByColumn[today]) {
            tasksByColumn[today].push(task);
          }
        } else if (task.next_due <= maxDate && tasksByColumn[task.next_due]) {
          // Tasks due within our 10-day view go to their specific day
          tasksByColumn[task.next_due].push(task);
        } else if (task.next_due > maxDate) {
          // Tasks due beyond our 10-day view go to Future
          futureTasks.push(task);
        }
      } else {
        // Tasks with no due date go to today
        if (tasksByColumn[today]) {
          tasksByColumn[today].push(task);
        }
      }
    });

    // Sort tasks within each column by their order field
    Object.keys(tasksByColumn).forEach((columnDate) => {
      tasksByColumn[columnDate].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    // Sort future tasks by their order field as well
    futureTasks.sort((a, b) => (a.order || 0) - (b.order || 0));

    return { tasksByColumn, futureTasks, days };
  };

  const { tasksByColumn, futureTasks, days } = distributeTasksToColumns();

  return (
    <div className={styles.boardContainer}>
      <div className={styles.boardHeader}>
        <h2>Board View - Next 10 Days</h2>
      </div>

      <div className={styles.boardScrollContainer}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.board}>
            {/* Day columns */}
            {days.map((day) => {
              const dayTasks = tasksByColumn[day.date] || [];
              return (
                <div key={day.date} className={styles.dayColumn}>
                  <div
                    className={`${styles.dayHeader} ${
                      day.isToday ? styles.today : ""
                    }`}
                    style={{ 
                      backgroundColor: day.headerColor, 
                      color: day.textColor 
                    }}
                  >
                    <div className={styles.dayName}>{day.dayName}</div>
                    <div className={styles.monthDay}>{day.monthDay}</div>
                    {day.isToday && (
                      <div className={styles.todayLabel}>Today</div>
                    )}
                  </div>

                  <SortableContext
                    id={day.date}
                    items={dayTasks.map((task) => task.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={styles.taskList}>
                      {dayTasks.length > 0 ? (
                        dayTasks.map((task) => (
                          <BoardTaskItem
                            key={task.id}
                            task={task}
                            onComplete={handleTaskComplete}
                            onClick={handleTaskClick}
                          />
                        ))
                      ) : (
                        <div className={styles.emptyState}>
                          No tasks scheduled
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}

            {/* Future column */}
            <div className={styles.dayColumn}>
              <div className={`${styles.dayHeader} ${styles.futureHeader}`}>
                <div className={styles.dayName}>Future</div>
                <div className={styles.monthDay}>Later</div>
              </div>

              <SortableContext
                id="future"
                items={futureTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={styles.taskList}>
                  {futureTasks.length > 0 ? (
                    futureTasks.map((task) => (
                      <BoardTaskItem
                        key={task.id}
                        task={task}
                        onComplete={handleTaskComplete}
                        onClick={handleTaskClick}
                      />
                    ))
                  ) : (
                    <div className={styles.emptyState}>No future tasks</div>
                  )}
                </div>
              </SortableContext>
            </div>
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className={styles.dragOverlay}>
                <BoardTaskItem
                  task={activeTask}
                  onComplete={() => {}} // Disabled during drag
                  onClick={() => {}} // Disabled during drag
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
        onSubtaskAdd={handleSubtaskAdd}
        onSubtaskUpdate={handleSubtaskUpdate}
        onSubtaskDelete={handleSubtaskDelete}
      />
    </div>
  );
};

export default BoardView;
