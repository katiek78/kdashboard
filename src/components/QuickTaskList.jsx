"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useSensors,
  useSensor,
  PointerSensor,
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import supabase from "../utils/supabaseClient";
import { useRouter } from "next/navigation";
import styles from "./QuickTaskList.module.css";
import SortableQTLItem from "./SortableQTLItem";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  fetchSubtasks,
  deleteSubtask,
  updateSubtask,
  getSubtaskCounts,
} from "../utils/subtaskUtils";

const QuickTaskList = () => {
  const router = useRouter();
  function playTask(id) {
    router.push(`/focus/${id}`);
  }
  const [tasks, setTasks] = useState([]);
  const [visibleTasks, setVisibleTasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  // Default next_due to today (YYYY-MM-DD) - calculated once
  const [newDue, setNewDue] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newRepeat, setNewRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [randomTaskId, setRandomTaskId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValuesMap, setEditValuesMap] = useState({});
  const [completingTaskId, setCompletingTaskId] = useState(null);

  // Refs for input fields to manually clear them
  const titleInputRef = useRef(null);
  const dueInputRef = useRef(null);
  const repeatInputRef = useRef(null);

  // Use onBlur instead of onChange for better performance
  const handleTitleBlur = useCallback((e) => {
    setNewTitle(e.target.value);
  }, []);

  const handleDueBlur = useCallback((e) => {
    setNewDue(e.target.value);
  }, []);

  const handleRepeatBlur = useCallback((e) => {
    setNewRepeat(e.target.value);
  }, []);

  // Debug function to reset stuck state
  const resetCompletingState = () => {
    console.log("Resetting completingTaskId from:", completingTaskId);
    setCompletingTaskId(null);
  };

  // Auto-reset completing state after 10 seconds (failsafe)
  useEffect(() => {
    if (completingTaskId !== null) {
      const timer = setTimeout(() => {
        console.warn(
          "Auto-resetting stuck completingTaskId:",
          completingTaskId
        );
        setCompletingTaskId(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [completingTaskId]);

  // Update visibleTasks whenever tasks changes
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setVisibleTasks(
      tasks.filter((task) => {
        // Show if next_due is null or today or earlier
        if (!task.next_due || task.next_due <= today) return true;
        return false;
      })
    );
  }, [tasks]);

  useEffect(() => {
    fetchTasks();
  }, []);

  // Only use editValuesMap for editing
  function onEdit(id) {
    const t = tasks.find((task) => task.id === id);
    setEditingId(id);
    // Always initialize next_due to a valid date string (current value or today)
    let nextDueInit = t.next_due;
    if (
      !nextDueInit ||
      typeof nextDueInit !== "string" ||
      nextDueInit.trim() === ""
    ) {
      nextDueInit = new Date().toISOString().slice(0, 10);
    }
    setEditValuesMap((prev) => ({
      ...prev,
      [id]: {
        title: t.title,
        next_due: nextDueInit,
        repeat: t.repeat || "",
      },
    }));
  }

  function onCancelEdit() {
    setEditingId(null);
  }

  async function onSaveEdit(id) {
    setLoading(true);
    const vals = editValuesMap[id];
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    let repeat = typeof vals.repeat === "string" ? vals.repeat.trim() : null;
    // If repeat is like 'Nm', auto-fill with today's day
    if (repeat && /^\d+m$/.test(repeat)) {
      const n = repeat.match(/^(\d+)m$/)[1];
      repeat = `${n}m${today.getDate()}`;
    }
    let next_due = vals.next_due;
    // If the user clears the date field, treat as null
    if (typeof next_due === "string" && next_due.trim() === "") {
      next_due = null;
    }
    if (typeof next_due === "undefined") {
      next_due = null;
    }
    // If repeat is set and next_due is empty/null, default to today
    if (repeat && !next_due) {
      next_due = todayStr;
    }
    // Otherwise, always save the picked date (even if repeat is empty)
    const updateObj = {
      title: vals.title,
      next_due: next_due === null ? null : String(next_due),
      repeat,
    };
    console.log("Saving task", id, updateObj);
    const { error, data } = await supabase
      .from("quicktasks")
      .update(updateObj)
      .eq("id", id)
      .select();
    if (error) {
      console.error("Supabase update error:", error);
    } else {
      console.log("Supabase update result:", data);
      // Update local state instead of refetching
      if (data && data[0]) {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === id ? { ...task, ...data[0] } : task
          )
        );
      }
    }
    setEditingId(null);
    setLoading(false);
  }

  // Mark a task as complete: advance next_due if repeat, else delete
  async function completeTask(id) {
    console.log(
      "completeTask called with id:",
      id,
      "completingTaskId:",
      completingTaskId
    );

    // Prevent double-clicks/multiple calls
    if (completingTaskId === id) {
      console.log("Task completion already in progress for:", id);
      return;
    }

    // Also prevent if any task is currently being completed
    if (completingTaskId !== null) {
      console.log(
        "Another task completion in progress:",
        completingTaskId,
        "ignoring:",
        id
      );
      return;
    }

    const t = tasks.find((task) => task.id === id);
    if (!t) {
      console.log("Task not found:", id);
      return;
    }

    setCompletingTaskId(id);
    console.log("Starting task completion for:", id, "repeat:", t.repeat);

    try {
      if (!t.repeat) {
        // Non-repeating: always delete when completed
        console.log("Non-repeating task - calling deleteTask");
        // Don't return early - let deleteTask handle its own completion state
        // but clear our state first to prevent conflicts
        setCompletingTaskId(null);
        await deleteTask(id);
        return;
      }

      setLoading(true);

      // For repeating tasks: advance the due date based on repeat type
      const rep = t.repeat.trim().toLowerCase();
      let next_due;
      if (/^\d+\s*(d|day|days)$/.test(rep) || rep === "d" || rep === "daily") {
        // Advance from today for day-based repeats
        const today = new Date().toISOString().slice(0, 10);
        console.log("Day-based repeat detected, using today:", today);
        next_due = getNextDue(today, t.repeat);
      } else {
        // Advance from previous next_due for schedule-based repeats
        const todayStr = new Date().toISOString().slice(0, 10);
        console.log(
          "Schedule-based repeat, using previous next_due:",
          t.next_due,
          "or todayStr:",
          todayStr
        );
        next_due = getNextDue(t.next_due || todayStr, t.repeat);
      }

      console.log("Advancing repeating task due date to:", next_due);

      // Update the task's next due date
      await supabase.from("quicktasks").update({ next_due }).eq("id", id);

      // Check if there are any subtasks before trying to reset them
      const subtaskCounts = await getSubtaskCounts(id);
      if (subtaskCounts.total > 0) {
        console.log(
          `Resetting ${subtaskCounts.total} subtasks for repeating task ${id}`
        );
        // Reset all subtasks to uncompleted using a single UPDATE query
        await supabase
          .from("subtasks")
          .update({ completed: false })
          .eq("parent_task_id", id);
      } else {
        console.log("No subtasks to reset for repeating task", id);
      }

      // Update task state locally instead of refetching all tasks
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === id ? { ...task, next_due } : task))
      );

      console.log("Repeating task completion successful");
    } catch (error) {
      console.error("Error completing task:", error);
      alert("Failed to complete task. Please try again.");
    } finally {
      setLoading(false);
      setCompletingTaskId(null);
    }
  }

  // Toggle urgent flag and reorder tasks accordingly
  async function toggleUrgent(id, urgent) {
    setLoading(true);

    try {
      const currentTask = tasks.find((task) => task.id === id);
      if (!currentTask) return;

      if (urgent) {
        // Making task urgent: move to bottom of urgent tasks
        const urgentTasks = tasks.filter(
          (task) => task.urgent && task.id !== id
        );
        const nonUrgentTasks = tasks.filter(
          (task) => !task.urgent && task.id !== id
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
          if (task.id === id) {
            updateData.urgent = urgent;
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
          (task) => task.urgent && task.id !== id
        );
        const nonUrgentTasks = tasks.filter(
          (task) => !task.urgent && task.id !== id
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
          if (task.id === id) {
            updateData.urgent = urgent;
          }
          return supabase
            .from("quicktasks")
            .update(updateData)
            .eq("id", task.id);
        });

        await Promise.all(updates);
      }

      console.log(`Task ${id} urgency changed to ${urgent} and reordered`);
    } catch (error) {
      console.error("Error toggling urgency and reordering:", error);
      alert("Failed to update task urgency. Please try again.");
    } finally {
      fetchTasks();
    }
  }

  // Helper to advance next_due based on repeat string (supports daily, weekly, N days, N months on Dth, etc)
  function getNextDue(current, repeat) {
    if (!repeat) return null;
    const base = current ? new Date(current) : new Date();
    const rep = repeat.trim().toLowerCase();
    // Handle patterns like 2sat, 3mon, etc. (every N weeks on weekday)
    const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const matchNWeekday = rep.match(/^(\d+)(sun|mon|tue|wed|thu|fri|sat)$/);
    if (matchNWeekday) {
      const n = parseInt(matchNWeekday[1], 10);
      const weekday = matchNWeekday[2];
      const idx = weekdays.indexOf(weekday);
      let next = new Date(base);
      // Find the next occurrence of the weekday
      let daysToAdd = (idx - next.getDay() + 7) % 7;
      if (daysToAdd === 0)
        daysToAdd = 7 * n; // always go to next interval if today
      else daysToAdd += 7 * (n - 1); // add (n-1) weeks if not today
      next.setDate(next.getDate() + daysToAdd);
      return next.toISOString().slice(0, 10);
    }
    // Handle weekday names (e.g. mon, tue, fri)
    const repShort = rep.slice(0, 3);
    const idx = weekdays.indexOf(repShort);
    if (idx !== -1) {
      // Advance to next occurrence of that weekday
      let daysToAdd = (idx - base.getDay() + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7; // always go to next week if today
      base.setDate(base.getDate() + daysToAdd);
      return base.toISOString().slice(0, 10);
    }
    if (rep === "daily" || rep === "d") {
      base.setDate(base.getDate() + 1);
      return base.toISOString().slice(0, 10);
    }
    if (rep === "weekly" || rep === "w") {
      base.setDate(base.getDate() + 7);
      return base.toISOString().slice(0, 10);
    }
    // e.g. 2d, 3d, 2 days
    const match = rep.match(/^(\d+)\s*(d|day|days)$/);
    if (match) {
      base.setDate(base.getDate() + parseInt(match[1], 10));
      return base.toISOString().slice(0, 10);
    }
    // e.g. 2w, 3w, 2 weeks
    const matchW = rep.match(/^(\d+)\s*(w|week|weeks)$/);
    if (matchW) {
      base.setDate(base.getDate() + 7 * parseInt(matchW[1], 10));
      return base.toISOString().slice(0, 10);
    }
    // e.g. 6m3 = every 6 months on the 3rd
    const matchM = rep.match(/^(\d+)m(\d{1,2})$/);
    if (matchM) {
      let n = parseInt(matchM[1], 10);
      let day = parseInt(matchM[2], 10);
      let next = new Date(base);
      // Move to next Nth month
      next.setMonth(next.getMonth() + n);
      // Set to the Dth day, but if invalid (e.g. 30th Feb), roll forward to next valid date
      let year = next.getFullYear();
      let month = next.getMonth();
      let maxDay = new Date(year, month + 1, 0).getDate();
      if (day > maxDay) day = maxDay;
      next.setDate(day);
      // If still in the past, roll forward another N months
      if (next <= base) {
        next.setMonth(next.getMonth() + n);
        year = next.getFullYear();
        month = next.getMonth();
        maxDay = new Date(year, month + 1, 0).getDate();
        if (day > maxDay) day = maxDay;
        next.setDate(day);
      }
      return next.toISOString().slice(0, 10);
    }
    // e.g. 07/10 = every year on 7th October (DD/MM format)
    const matchDate = rep.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (matchDate) {
      const day = parseInt(matchDate[1], 10);
      const month = parseInt(matchDate[2], 10) - 1; // JavaScript months are 0-indexed
      let next = new Date(base.getFullYear(), month, day);

      // If the date has already passed this year, move to next year
      if (next <= base) {
        next.setFullYear(next.getFullYear() + 1);
      }

      // Handle invalid dates (e.g. 30/02 -> Feb 30th doesn't exist)
      if (next.getMonth() !== month) {
        // Date overflowed to next month, so set to last day of target month
        next = new Date(next.getFullYear(), month + 1, 0); // Last day of target month
        // If this is still in the past, try next year
        if (next <= base) {
          next = new Date(next.getFullYear() + 1, month + 1, 0);
        }
      }

      return next.toISOString().slice(0, 10);
    }
    // fallback: just add 1 day
    base.setDate(base.getDate() + 1);
    return base.toISOString().slice(0, 10);
  }

  // RepeatBadge: shows a colored badge for repeat type
  function RepeatBadge({ repeat }) {
    if (!repeat) return null;
    const rep = repeat.trim().toLowerCase();
    // Weekday logic
    const weekdayMap = {
      mon: { label: "M", color: "#e53935" }, // red
      tue: { label: "Tu", color: "#fb8c00" }, // orange
      wed: { label: "W", color: "#43a047" }, // lime/green
      thu: { label: "Th", color: "#1e88e5" }, // blue
      fri: { label: "F", color: "#3949ab" }, // indigo
      sat: { label: "Sa", color: "#8e24aa" }, // violet
      sun: { label: "Su", color: "#757575" }, // gray
    };
    const repShort = rep.slice(0, 3);
    if (weekdayMap[repShort]) {
      const { label, color } = weekdayMap[repShort];
      return (
        <span
          style={{
            background: color,
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
          {label}
        </span>
      );
    }
    // Daily/ND logic (e.g. daily, 2d, 3d, 2 days)
    if (rep === "daily" || /^\d+\s*(d|day|days)$/.test(rep)) {
      return (
        <span
          style={{
            background: "#43a047", // green
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
    if (/^\d+(st|nd|rd|th)$/.test(rep)) {
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

  const sensors = useSensors(useSensor(PointerSensor));

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = tasks.findIndex((task) => task.id === active.id);
      const newIndex = tasks.findIndex((task) => task.id === over.id);
      const newTasks = arrayMove(tasks, oldIndex, newIndex);

      setTasks(newTasks);

      //update task orders in supabase
      await Promise.all(
        newTasks.map((task, idx) =>
          supabase
            .from("quicktasks")
            .update({ order: idx + 1 })
            .eq("id", task.id)
        )
      );
      fetchTasks();
    }
  }

  async function fetchTasks() {
    setLoading(true);
    const { data, error, count } = await supabase
      .from("quicktasks")
      .select("*", { count: "exact" })
      .order("order", { ascending: true });
    if (!error) {
      setTasks(data);
    }
    setLoading(false);
  }

  async function addTask() {
    if (!newTitle.trim()) return;
    // Find the highest order value
    const maxOrder =
      tasks.length > 0 ? Math.max(...tasks.map((t) => t.order)) : 0;
    const nextOrder = maxOrder + 1;
    // Always set next_due if provided
    let insertDue = newDue;
    if (typeof insertDue === "string" && insertDue.trim() === "") {
      insertDue = null;
    }
    if (typeof insertDue === "undefined") {
      insertDue = null;
    }
    const insertObj = {
      title: newTitle,
      order: nextOrder,
      repeat: newRepeat || null,
      next_due: insertDue === null ? null : String(insertDue),
    };
    const { data, error } = await supabase
      .from("quicktasks")
      .insert([insertObj])
      .select();
    if (!error && data) {
      // Add the new task to local state instead of refetching
      const newTask = data[0];
      setTasks((prevTasks) => [...prevTasks, newTask]);

      setNewTitle("");
      setNewDue(new Date().toISOString().slice(0, 10));
      setNewRepeat("");

      // Clear the input fields manually since we're using defaultValue
      if (titleInputRef.current) titleInputRef.current.value = "";
      if (dueInputRef.current)
        dueInputRef.current.value = new Date().toISOString().slice(0, 10);
      if (repeatInputRef.current) repeatInputRef.current.value = "";
    }
  }

  async function deleteTask(id) {
    // Prevent double-clicks/multiple calls
    if (completingTaskId === id) {
      console.log("Delete already in progress for task:", id);
      return;
    }

    // Find the task to get its title for the confirmation dialog
    const task = tasks.find((t) => t.id === id);
    const taskTitle = task ? task.title : "this task";

    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${taskTitle}"?\n\nThis will also delete all subtasks associated with this task. This action cannot be undone.`
    );

    if (!confirmDelete) {
      console.log("User cancelled deletion of task:", id);
      return; // User cancelled
    }

    console.log("User confirmed deletion of task:", id);
    setCompletingTaskId(id);

    try {
      // First, delete all subtasks associated with this task
      console.log("Deleting subtasks for task:", id);
      const { error: subtaskError, count: deletedCount } = await supabase
        .from("subtasks")
        .delete()
        .eq("parent_task_id", id);

      // Only treat it as an error if it's a real error (not just "no rows found")
      if (subtaskError && subtaskError.code !== "PGRST116") {
        console.error("Error deleting subtasks:", subtaskError);
        alert("Failed to delete subtasks. Please try again.");
        return;
      }

      if (deletedCount > 0) {
        console.log(
          `${deletedCount} subtasks deleted successfully for task:`,
          id
        );
      } else {
        console.log("No subtasks found for task:", id);
      }

      // Now delete the main task
      const { error } = await supabase.from("quicktasks").delete().eq("id", id);

      if (error) {
        console.error("Error deleting task:", error);
        alert("Failed to delete task. Please try again.");
      } else {
        console.log("Task deleted successfully:", id);
        // Remove task from state locally instead of refetching all tasks
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      }
    } catch (error) {
      console.error("Error during task deletion:", error);
      alert("Failed to delete task. Please try again.");
    } finally {
      setCompletingTaskId(null);
    }
  }

  function pickRandomTask() {
    // Only pick from visible tasks that are not blocked
    const unblocked = visibleTasks.filter((t) => !t.blocked);
    if (unblocked.length === 0) return;
    const urgent = unblocked.filter((t) => t.urgent);
    const nonUrgent = unblocked.filter((t) => !t.urgent);
    let pool = unblocked;
    if (urgent.length > 0 && nonUrgent.length > 0) {
      // 80% chance urgent, 20% non-urgent
      pool = Math.random() < 0.8 ? urgent : nonUrgent;
    } else if (urgent.length > 0) {
      pool = urgent;
    } else if (nonUrgent.length > 0) {
      pool = nonUrgent;
    }
    const randomIdx = Math.floor(Math.random() * pool.length);
    setRandomTaskId(pool[randomIdx].id);
  }

  async function toggleBlocked(id, blocked) {
    setLoading(true);
    const { error } = await supabase
      .from("quicktasks")
      .update({ blocked })
      .eq("id", id);
    if (!error) {
      // Update local state instead of refetching
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === id ? { ...task, blocked } : task))
      );
    }
    setLoading(false);
  }

  return (
    <div className={styles.taskContainer + " pageContainer"}>
      <div>
        <input
          ref={titleInputRef}
          type="text"
          placeholder="Task name"
          defaultValue={newTitle}
          onBlur={handleTitleBlur}
        />
        <input
          ref={dueInputRef}
          type="date"
          name="next_due"
          defaultValue={newDue}
          onBlur={handleDueBlur}
          placeholder="Due date"
        />
        <input
          ref={repeatInputRef}
          type="text"
          name="repeat"
          defaultValue={newRepeat}
          onBlur={handleRepeatBlur}
          placeholder="Repeat (e.g. daily, weekly, 2w, 1m, Mon, 1st, 07/10, etc)"
        />
        <button onClick={addTask}>Add Task</button>
      </div>
      <div style={{ margin: "12px 0", fontWeight: 500, fontSize: 18 }}>
        Total tasks for today: {visibleTasks?.length}
        {/* {completingTaskId && (
          <span style={{ marginLeft: 20, color: "#ff9800", fontSize: 14 }}>
            Completing: {completingTaskId}
            <button
              onClick={resetCompletingState}
              style={{ marginLeft: 8, fontSize: 12, padding: "2px 6px" }}
            >
              Reset
            </button>
          </span>
        )} */}
      </div>
      <button onClick={pickRandomTask}>Pick Random Task</button>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tasks.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* .sort((a, b) => {
                  // Urgent tasks first
                  if (!!b.urgent - !!a.urgent !== 0)
                    return !!b.urgent - !!a.urgent;
                  // One-off (non-repeating) tasks next
                  if (!!a.repeat !== !!b.repeat) return !!a.repeat - !!b.repeat;
                  // Otherwise, keep original order (by id or order field)
                  return (a.order ?? a.id) - (b.order ?? b.id);
                }) */}
            <div className={styles.quickTaskList}>
              {visibleTasks.map((task, idx) => (
                <SortableQTLItem
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  next_due={task.next_due}
                  repeat={task.repeat}
                  blocked={!!task.blocked}
                  urgent={!!task.urgent}
                  onDelete={deleteTask}
                  onPlay={playTask}
                  onToggleBlocked={toggleBlocked}
                  onToggleUrgent={toggleUrgent}
                  highlight={task.id === randomTaskId}
                  onEdit={onEdit}
                  isEditing={editingId === task.id}
                  editValues={
                    editValuesMap[task.id] || {
                      title: "",
                      next_due: "",
                      repeat: "",
                    }
                  }
                  setEditValues={(fn) =>
                    setEditValuesMap((prev) => ({
                      ...prev,
                      [task.id]: fn(
                        prev[task.id] || {
                          title: task.title,
                          next_due: task.next_due || "",
                          repeat: task.repeat || "",
                        }
                      ),
                    }))
                  }
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  onComplete={completeTask}
                  rowIndex={idx}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default QuickTaskList;
