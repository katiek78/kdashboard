"use client";
import { useState, useEffect } from "react";
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

const QuickTaskList = () => {
  const router = useRouter();
  function playTask(id) {
    router.push(`/focus/${id}`);
  }
  const [tasks, setTasks] = useState([]);
  const [taskCount, setTaskCount] = useState(0);
  const [visibleTasks, setVisibleTasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  // Default next_due to today (YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [newDue, setNewDue] = useState(todayStr);
  const [newRepeat, setNewRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [randomTaskId, setRandomTaskId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValuesMap, setEditValuesMap] = useState({});

  // Update visibleTasks whenever tasks or loading changes
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setVisibleTasks(
      tasks.filter((task) => !task.next_due || task.next_due <= today)
    );
  }, [tasks, loading]);

  useEffect(() => {
    fetchTasks();
  }, []);

  // Only use editValuesMap for editing
  function onEdit(id) {
    const t = tasks.find((task) => task.id === id);
    setEditingId(id);
    setEditValuesMap((prev) => ({
      ...prev,
      [id]: {
        title: t.title,
        next_due: t.next_due || "",
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
    if (repeat && !next_due) {
      next_due = todayStr;
    }
    if (!repeat) {
      next_due = null;
    }
    const updateObj = {
      title: vals.title,
      next_due,
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
    }
    setEditingId(null);
    fetchTasks();
  }

  // Mark a task as complete: advance next_due if repeat, else delete
  async function completeTask(id) {
    const t = tasks.find((task) => task.id === id);
    if (!t) return;
    if (!t.repeat) {
      // Non-repeating: delete
      await deleteTask(id);
      return;
    }
    let next_due = getNextDue(t.next_due || todayStr, t.repeat);
    setLoading(true);
    await supabase.from("quicktasks").update({ next_due }).eq("id", id);
    fetchTasks();
  }

  // Toggle urgent flag
  async function toggleUrgent(id, urgent) {
    setLoading(true);
    await supabase.from("quicktasks").update({ urgent }).eq("id", id);
    fetchTasks();
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
    if (rep === "daily") {
      base.setDate(base.getDate() + 1);
      return base.toISOString().slice(0, 10);
    }
    if (rep === "weekly") {
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
      setTaskCount(count ?? data.length);
    }
    setLoading(false);
  }

  async function addTask() {
    if (!newTitle.trim()) return;
    // Find the highest order value
    const maxOrder =
      tasks.length > 0 ? Math.max(...tasks.map((t) => t.order)) : 0;
    const nextOrder = maxOrder + 1;
    // Only set next_due if repeat is provided
    const insertObj = {
      title: newTitle,
      order: nextOrder,
      repeat: newRepeat || null,
    };
    if (newRepeat) {
      insertObj.next_due = newDue || todayStr;
    }
    const { error } = await supabase.from("quicktasks").insert([insertObj]);
    if (!error) {
      setNewTitle("");
      setNewDue(todayStr);
      setNewRepeat("");
      fetchTasks();
    }
  }

  async function deleteTask(id) {
    console.log(id);
    setLoading(true);
    await supabase.from("quicktasks").delete().eq("id", id);
    fetchTasks();
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
    await supabase.from("quicktasks").update({ blocked }).eq("id", id);
    fetchTasks();
  }

  return (
    <div className={styles.taskContainer + " pageContainer"}>
      <div>
        <input
          type="text"
          placeholder="Task name"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <input
          type="date"
          name="next_due"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          placeholder="Due date"
        />
        <input
          type="text"
          name="repeat"
          value={newRepeat}
          onChange={(e) => setNewRepeat(e.target.value)}
          placeholder="Repeat (e.g. daily, weekly, 2w, 1m, Mon, 1st, etc)"
        />
        <button onClick={addTask}>Add Task</button>
      </div>
      <div style={{ margin: "12px 0", fontWeight: 500, fontSize: 18 }}>
        Total tasks: {taskCount}
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
