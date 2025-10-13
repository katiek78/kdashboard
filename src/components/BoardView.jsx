import React, { useState, useMemo, useEffect, useRef } from "react";
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

const BoardView = ({ tasks = [], onTaskUpdate, onTaskComplete, router }) => {
  const [activeTask, setActiveTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addingToColumn, setAddingToColumn] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const boardContainerRef = useRef(null);

  // Prevent browser back navigation on horizontal scroll/swipe
  useEffect(() => {
    const handleWheel = (e) => {
      // Only prevent if we're in the board area and it's primarily horizontal scrolling
      const target = e.target;
      const isInBoard =
        target.closest(`.${styles.boardContainer}`) ||
        target.closest(`.${styles.boardScrollContainer}`);

      if (isInBoard && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // This is primarily horizontal scrolling within the board
        e.preventDefault();

        // Manually handle the scroll
        const scrollContainer =
          target.closest(`.${styles.boardScrollContainer}`) ||
          document.querySelector(`.${styles.boardScrollContainer}`);
        if (scrollContainer) {
          scrollContainer.scrollLeft += e.deltaX;
        }
      }
    };

    // Add the event listener to the document to catch all wheel events
    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Automatically reorder future tasks by date when tasks change
  useEffect(() => {
    // Only run if we have tasks and this is not the initial empty state
    if (tasks && tasks.length > 0) {
      const checkAndReorderFuture = async () => {
        try {
          // Generate 10 days starting from today to determine maxDate
          const today = new Date();
          const maxDate = new Date(today.getTime() + 9 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

          const futureTasks = tasks.filter(
            (task) => task.next_due && task.next_due > maxDate
          );

          if (futureTasks.length > 0) {
            // Check if future tasks are already properly ordered by date
            const sortedByDate = [...futureTasks].sort((a, b) => {
              if (a.next_due && b.next_due) {
                return a.next_due.localeCompare(b.next_due);
              }
              return 0;
            });

            const sortedByOrder = [...futureTasks].sort(
              (a, b) => (a.order || 0) - (b.order || 0)
            );

            // Check if the date order matches the current order
            const needsReordering = sortedByDate.some(
              (task, index) => task.id !== sortedByOrder[index]?.id
            );

            if (needsReordering) {
              console.log("Future tasks need reordering by date");
              const reorderedTasks = await reorderFutureTasksByDate();
              if (onTaskUpdate && reorderedTasks) {
                onTaskUpdate(reorderedTasks);
              }
            }
          }
        } catch (error) {
          console.error("Error checking future task order:", error);
        }
      };

      // Use a timeout to avoid running this too frequently
      const timeoutId = setTimeout(checkAndReorderFuture, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [tasks]);

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

  const handleTaskComplete = async (taskId) => {
    console.log("BoardView handleTaskComplete called with taskId:", taskId);
    console.log("onTaskComplete function exists:", !!onTaskComplete);
    if (onTaskComplete) {
      console.log("About to call onTaskComplete with taskId:", taskId);
      await onTaskComplete(taskId);
      console.log("onTaskComplete completed for taskId:", taskId);
      // No additional update needed - parent handles state
    } else {
      console.log("No onTaskComplete function provided");
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
      const originalTask = tasks.find((t) => t.id === updatedTask.id);
      const urgentStatusChanged =
        originalTask && originalTask.urgent !== updatedTask.urgent;

      if (urgentStatusChanged) {
        // Handle urgent status change with reordering
        const currentTask = originalTask;
        const urgent = updatedTask.urgent;

        if (urgent) {
          // Making task urgent: move to bottom of urgent tasks
          const urgentTasks = tasks.filter(
            (task) => task.urgent && task.id !== updatedTask.id
          );
          const nonUrgentTasks = tasks.filter(
            (task) => !task.urgent && task.id !== updatedTask.id
          );

          // New order: [existing urgent tasks, newly urgent task, non-urgent tasks]
          const newTaskOrder = [
            ...urgentTasks,
            { ...currentTask, urgent: true },
            ...nonUrgentTasks,
          ];

          // Update all affected tasks with new order values
          const updates = newTaskOrder.map((task, index) => {
            const updateData = { order: index + 1 };
            if (task.id === updatedTask.id) {
              // Include all the updated fields for the main task
              updateData.title = updatedTask.title;
              updateData.description = updatedTask.description;
              updateData.next_due = updatedTask.next_due;
              updateData.urgent = updatedTask.urgent;
              updateData.blocked = updatedTask.blocked;
              updateData.repeat = updatedTask.repeat;
            }
            return supabase
              .from("quicktasks")
              .update(updateData)
              .eq("id", task.id);
          });

          await Promise.all(updates);
        } else {
          // Making task non-urgent: move to bottom of all tasks
          const urgentTasks = tasks.filter(
            (task) => task.urgent && task.id !== updatedTask.id
          );
          const nonUrgentTasks = tasks.filter(
            (task) => !task.urgent && task.id !== updatedTask.id
          );

          // New order: [urgent tasks, non-urgent tasks, newly non-urgent task]
          const newTaskOrder = [
            ...urgentTasks,
            ...nonUrgentTasks,
            { ...currentTask, urgent: false },
          ];

          // Update all affected tasks with new order values
          const updates = newTaskOrder.map((task, index) => {
            const updateData = { order: index + 1 };
            if (task.id === updatedTask.id) {
              // Include all the updated fields for the main task
              updateData.title = updatedTask.title;
              updateData.description = updatedTask.description;
              updateData.next_due = updatedTask.next_due;
              updateData.urgent = updatedTask.urgent;
              updateData.blocked = updatedTask.blocked;
              updateData.repeat = updatedTask.repeat;
            }
            return supabase
              .from("quicktasks")
              .update(updateData)
              .eq("id", task.id);
          });

          await Promise.all(updates);
        }
      } else {
        // No urgent status change, just update the task normally
        const { error } = await supabase
          .from("quicktasks")
          .update({
            title: updatedTask.title,
            description: updatedTask.description,
            next_due: updatedTask.next_due,
            urgent: updatedTask.urgent,
            blocked: updatedTask.blocked,
            repeat: updatedTask.repeat,
          })
          .eq("id", updatedTask.id);

        if (error) throw error;
      }

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

      // Update local state by removing the deleted task
      const updatedTasks = tasks.filter((t) => t.id !== taskId);
      if (onTaskUpdate) {
        onTaskUpdate(updatedTasks);
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

  // Task creation handlers
  const handleAddTaskToColumn = (columnId) => {
    setAddingToColumn(columnId);
    setNewTaskTitle("");

    // Set default date for future column (first day after the 10-day view)
    if (columnId === "future") {
      const today = new Date();
      const defaultFutureDate = new Date(
        today.getTime() + 10 * 24 * 60 * 60 * 1000
      );
      setNewTaskDate(defaultFutureDate.toISOString().slice(0, 10));
    } else {
      setNewTaskDate("");
    }
  };

  const handleCancelAddTask = () => {
    setAddingToColumn(null);
    setNewTaskTitle("");
    setNewTaskDate("");
  };

  const handleCreateTask = async (columnId) => {
    if (!newTaskTitle.trim()) return;

    try {
      // Determine the next_due date based on the column
      let nextDue = null;
      if (columnId !== "future") {
        nextDue = columnId; // columnId is the date string (YYYY-MM-DD)
      } else if (newTaskDate) {
        // For future column, use the provided date if available
        nextDue = newTaskDate;
      }
      // For future column without date, nextDue stays null

      // Find the highest order value for proper task ordering
      const maxOrder =
        tasks.length > 0 ? Math.max(...tasks.map((t) => t.order || 0)) : 0;
      const nextOrder = maxOrder + 1;

      const newTask = {
        title: newTaskTitle.trim(),
        order: nextOrder,
        next_due: nextDue,
        urgent: false,
        blocked: false,
        repeat: null,
      };

      const { data, error } = await supabase
        .from("quicktasks")
        .insert(newTask)
        .select();

      if (error) throw error;

      // Add the new task to local state immediately (with the ID from database)
      const createdTask = data[0];
      const updatedTasks = [...tasks, createdTask];

      // If adding to future column with a date, reorder future tasks by date
      if (columnId === "future" && newTaskDate) {
        const reorderedTasks = await reorderFutureTasksByDate(updatedTasks);
        if (onTaskUpdate) {
          onTaskUpdate(reorderedTasks, "future");
        }
      } else {
        // For other columns, just update local state directly
        if (onTaskUpdate) {
          const scrollToColumn = columnId === "future" ? "future" : null;
          onTaskUpdate(updatedTasks, scrollToColumn);
        }
      }

      // Reset form
      setAddingToColumn(null);
      setNewTaskTitle("");
      setNewTaskDate("");
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task");
    }
  };

  const handleKeyPress = (e, columnId) => {
    if (e.key === "Enter") {
      handleCreateTask(columnId);
    } else if (e.key === "Escape") {
      handleCancelAddTask();
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

      // If moving to future column, reorder all future tasks by date
      if (targetColumnId === "future") {
        const reorderedTasks = await reorderFutureTasksByDate(updatedTasks);
        onTaskUpdate(reorderedTasks);
        return; // Exit early since we've already updated
      }

      console.log("Task moved successfully");
    } catch (error) {
      console.error("Error moving task:", error);
      // Revert local state on error
      onTaskUpdate(tasks);
    }
  };

  // Helper function to reorder all future tasks by their due dates
  const reorderFutureTasksByDate = async (tasksToReorder = tasks) => {
    try {
      // Get all future tasks (tasks with due dates beyond the 10-day view)
      const today = new Date();
      const maxDate = new Date(today.getTime() + 9 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const futureTasks = tasksToReorder.filter(
        (task) => task.next_due && task.next_due > maxDate
      );

      // Sort by date, then by current order
      const sortedFutureTasks = [...futureTasks].sort((a, b) => {
        if (a.next_due && b.next_due) {
          const dateCompare = a.next_due.localeCompare(b.next_due);
          if (dateCompare !== 0) return dateCompare;
        } else if (a.next_due && !b.next_due) {
          return -1;
        } else if (!a.next_due && b.next_due) {
          return 1;
        }
        return (a.order || 0) - (b.order || 0);
      });

      // Update order values based on sorted position
      const updates = sortedFutureTasks.map((task, index) => ({
        id: task.id,
        order: index + 1,
      }));

      if (updates.length > 0) {
        // Update database with new orders
        await Promise.all(
          updates.map((update) =>
            supabase
              .from("quicktasks")
              .update({ order: update.order })
              .eq("id", update.id)
          )
        );
        console.log("Future tasks reordered by date successfully");

        // Return updated tasks array with new order values
        return tasksToReorder.map((task) => {
          const update = updates.find((u) => u.id === task.id);
          return update ? { ...task, order: update.order } : task;
        });
      }

      return tasksToReorder;
    } catch (error) {
      console.error("Error reordering future tasks by date:", error);
      return tasksToReorder;
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
        // Pure daily tasks (d, daily) should still respect their next_due date
        // but if they have no next_due date, they go to today
        if (rep === "d" || rep === "daily") {
          if (!task.next_due) {
            // Daily tasks with no due date go to today
            if (tasksByColumn[today]) {
              tasksByColumn[today].push(task);
            }
            return;
          }
          // If daily task has a next_due date, fall through to use that date
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

    // Sort future tasks by date first (earlier dates at top), then by order
    futureTasks.sort((a, b) => {
      // First sort by next_due date (nulls last)
      if (a.next_due && b.next_due) {
        const dateCompare = a.next_due.localeCompare(b.next_due);
        if (dateCompare !== 0) return dateCompare;
      } else if (a.next_due && !b.next_due) {
        return -1; // tasks with dates come before tasks without dates
      } else if (!a.next_due && b.next_due) {
        return 1; // tasks without dates come after tasks with dates
      }
      // If dates are equal (or both null), sort by order
      return (a.order || 0) - (b.order || 0);
    });

    return { tasksByColumn, futureTasks, days };
  };

  const { tasksByColumn, futureTasks, days } = useMemo(() => {
    return distributeTasksToColumns();
  }, [tasks]);

  return (
    <div className={styles.boardContainer} ref={boardContainerRef}>
      <div className={styles.boardHeader}>
        <h2>Board View</h2>
        {router && (
          <button
            onClick={() => router.push("/tasks")}
            className={styles.backButton}
          >
            Back to Today View
          </button>
        )}
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
                      color: day.textColor,
                    }}
                  >
                    <div className={styles.dayName}>{day.dayName}</div>
                    <div className={styles.monthDay}>{day.monthDay}</div>
                    {day.isToday && (
                      <div className={styles.todayLabel}>Today</div>
                    )}
                    <button
                      className={styles.addTaskButton}
                      onClick={() => handleAddTaskToColumn(day.date)}
                      title={`Add task to ${day.dayName}`}
                    >
                      +
                    </button>
                    {dayTasks.length > 0 && (
                      <div className={styles.taskCount}>{dayTasks.length}</div>
                    )}
                  </div>

                  {/* Add task input for this column */}
                  {addingToColumn === day.date && (
                    <div className={styles.addTaskForm}>
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, day.date)}
                        placeholder="Enter task title..."
                        className={styles.addTaskInput}
                        autoFocus
                      />
                      <div className={styles.addTaskActions}>
                        <button
                          onClick={() => handleCreateTask(day.date)}
                          className={styles.addTaskSave}
                          disabled={!newTaskTitle.trim()}
                        >
                          Add
                        </button>
                        <button
                          onClick={handleCancelAddTask}
                          className={styles.addTaskCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

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
                <button
                  className={styles.addTaskButton}
                  onClick={() => handleAddTaskToColumn("future")}
                  title="Add task to Future"
                >
                  +
                </button>
                {futureTasks.length > 0 && (
                  <div className={styles.taskCount}>{futureTasks.length}</div>
                )}
                <button
                  className={styles.addTaskButton}
                  onClick={() => handleAddTaskToColumn("future")}
                  title="Add task to Future"
                >
                  +
                </button>
              </div>

              {/* Add task input for Future column */}
              {addingToColumn === "future" && (
                <div className={styles.addTaskForm}>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, "future")}
                    placeholder="Enter task title..."
                    className={styles.addTaskInput}
                    autoFocus
                  />
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, "future")}
                    placeholder="Due date (optional)"
                    className={styles.addTaskInput}
                    title="Due date (optional)"
                  />
                  <div className={styles.addTaskActions}>
                    <button
                      onClick={() => handleCreateTask("future")}
                      className={styles.addTaskSave}
                      disabled={!newTaskTitle.trim()}
                    >
                      Add
                    </button>
                    <button
                      onClick={handleCancelAddTask}
                      className={styles.addTaskCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
