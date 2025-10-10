"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../../utils/supabaseClient";
import { getSubtaskCounts } from "../../../utils/subtaskUtils";
import BoardView from "../../../components/BoardView";
import styles from "./page.module.css";

const BoardPage = () => {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("quicktasks")
      .select("*")
      .order("order", { ascending: true });

    if (!error) {
      setTasks(data || []);
    }
    setLoading(false);
  }

  const handleTaskUpdate = (updatedTasks) => {
    setTasks(updatedTasks);
  };

  // Simplified task completion for board view
  const handleTaskComplete = async (id) => {
    console.log("Board page handling task completion:", id);

    try {
      const task = tasks.find((t) => t.id === id);
      if (!task) {
        console.log("Task not found:", id);
        return;
      }

      if (!task.repeat) {
        // Non-repeating: delete when completed
        const confirmDelete = window.confirm(
          `Are you sure you want to delete "${task.title}"?\n\nThis will also delete all subtasks associated with this task. This action cannot be undone.`
        );

        if (confirmDelete) {
          const { error } = await supabase
            .from("quicktasks")
            .delete()
            .eq("id", id);
          if (!error) {
            // Remove from local state
            setTasks((prevTasks) => prevTasks.filter((t) => t.id !== id));
          }
        }
      } else {
        // Repeating: advance due date and reset subtasks
        const todayStr = new Date().toISOString().slice(0, 10);
        const rep = task.repeat.trim().toLowerCase();

        let next_due;
        if (
          /^\d+\s*(d|day|days)$/.test(rep) ||
          rep === "d" ||
          rep === "daily"
        ) {
          // Day-based repeats advance from today
          next_due = getNextDue(todayStr, task.repeat);
        } else {
          // Schedule-based repeats advance from previous due date
          next_due = getNextDue(task.next_due || todayStr, task.repeat);
        }

        // Update task due date
        await supabase.from("quicktasks").update({ next_due }).eq("id", id);

        // Reset subtasks if any
        const subtaskCounts = await getSubtaskCounts(id);
        if (subtaskCounts.total > 0) {
          await supabase
            .from("subtasks")
            .update({ completed: false })
            .eq("parent_task_id", id);
        }

        // Update local state
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === id ? { ...t, next_due } : t))
        );
      }
    } catch (error) {
      console.error("Error completing task:", error);
      alert("Failed to complete task. Please try again.");
    }
  };

  // Helper function for date advancement (comprehensive version)
  const getNextDue = (current, repeat) => {
    console.log("Board getNextDue called with:", current, repeat);

    if (!repeat) return null;
    const base = current ? new Date(current) : new Date();
    const rep = repeat.trim().toLowerCase();

    console.log("Processing repeat pattern:", rep);

    // Handle weekday names (e.g. mon, tue, fri)
    const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const repShort = rep.slice(0, 3);
    const idx = weekdays.indexOf(repShort);
    if (idx !== -1) {
      // Advance to next occurrence of that weekday
      let daysToAdd = (idx - base.getDay() + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7; // always go to next week if today
      base.setDate(base.getDate() + daysToAdd);
      const result = base.toISOString().slice(0, 10);
      console.log("Weekday result:", result);
      return result;
    }

    if (rep === "daily" || rep === "d") {
      base.setDate(base.getDate() + 1);
      const result = base.toISOString().slice(0, 10);
      console.log("Daily result:", result);
      return result;
    }

    if (rep === "weekly" || rep === "w") {
      base.setDate(base.getDate() + 7);
      const result = base.toISOString().slice(0, 10);
      console.log("Weekly result:", result);
      return result;
    }

    // e.g. 2d, 3d, 2 days
    const match = rep.match(/^(\d+)\s*(d|day|days)$/);
    if (match) {
      const days = parseInt(match[1], 10);
      console.log("Matched day pattern, adding", days, "days");
      base.setDate(base.getDate() + days);
      const result = base.toISOString().slice(0, 10);
      console.log("Day pattern result:", result);
      return result;
    }

    // e.g. 2w, 3w, 2 weeks
    const matchW = rep.match(/^(\d+)\s*(w|week|weeks)$/);
    if (matchW) {
      const weeks = parseInt(matchW[1], 10);
      base.setDate(base.getDate() + 7 * weeks);
      const result = base.toISOString().slice(0, 10);
      console.log("Week pattern result:", result);
      return result;
    }

    // Fallback: add 1 day
    console.log("Using fallback - adding 1 day");
    base.setDate(base.getDate() + 1);
    const result = base.toISOString().slice(0, 10);
    console.log("Fallback result:", result);
    return result;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <BoardView
        tasks={tasks}
        onTaskUpdate={handleTaskUpdate}
        onTaskComplete={handleTaskComplete}
        router={router}
      />
    </div>
  );
};

export default BoardPage;
