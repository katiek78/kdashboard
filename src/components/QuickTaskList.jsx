"use client";
import { useState, useEffect } from "react";
import supabase from "../utils/supabaseClient";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPlay,
  faBan,
  faPen,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./QuickTaskList.module.css";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
function SortableQTLItem({
  id,
  title,
  next_due,
  repeat,
  blocked,
  urgent,
  onDelete,
  onPlay,
  onToggleBlocked,
  onToggleUrgent,
  highlight,
  rowIndex = 0,
  onEdit,
  isEditing,
  editValues,
  setEditValues,
  onSaveEdit,
  onCancelEdit,
  onComplete,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontFamily: "'Patrick Hand', cursive",
    fontSize: "1.5rem",
    background: highlight
      ? "#ffe066"
      : rowIndex % 2 === 0
      ? "rgba(0,0,0,0.07)"
      : "transparent",
    boxShadow: highlight ? "0 0 20px 5px #ffe066" : "none",
    border: highlight ? "2px solid #f79533" : "none",
    padding: 4,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {isEditing ? (
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <input
            type="text"
            value={editValues.title}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, title: e.target.value }))
            }
            style={{ fontSize: "1.1rem", marginRight: 4 }}
          />
          <input
            type="date"
            value={editValues.next_due || new Date().toISOString().slice(0, 10)}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, next_due: e.target.value }))
            }
            style={{ fontSize: "1.1rem", marginRight: 4 }}
          />
          <input
            type="text"
            value={editValues.repeat || ""}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, repeat: e.target.value }))
            }
            placeholder="Repeat"
            style={{ fontSize: "1.1rem", marginRight: 4, width: 90 }}
          />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => onSaveEdit(id)} style={{ marginRight: 2 }}>
              Save
            </button>
            <button onClick={onCancelEdit} style={{ marginRight: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {urgent && (
              <FontAwesomeIcon
                icon={faStar}
                style={{ color: "#d00", fontSize: 20, marginRight: 2 }}
                title="High priority"
              />
            )}
            {title}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "auto",
              gap: 10,
            }}
          >
            <input
              type="checkbox"
              onChange={() => onComplete && onComplete(id)}
              style={{
                width: 25,
                height: 25,
                marginTop: "8px",
              }}
              title="Mark as complete"
            />
            <button
              title={urgent ? "Unmark urgent" : "Mark as urgent"}
              onClick={() => onToggleUrgent(id, !urgent)}
              style={{
                background: urgent ? "#d00" : "#eee",
                color: urgent ? "#fff" : "#d00",
                border: urgent ? "2px solid #d00" : "1px solid #ccc",
                borderRadius: 6,
                fontWeight: 700,
                padding: "2px 8px",
                cursor: "pointer",
                minWidth: 32,
                minHeight: 32,
              }}
            >
              !
            </button>
            <button
              title="Edit"
              onClick={() => onEdit(id)}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                color: "#333",
                fontSize: 20,
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
            <button
              title={blocked ? "Unblock task" : "Block task"}
              onClick={() => onToggleBlocked(id, !blocked)}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                color: blocked ? "#c00" : "#888",
                fontSize: 20,
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faBan} />
            </button>
            <button
              title="Play"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(id);
              }}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon
                icon={faPlay}
                size="lg"
                style={{ color: "black" }}
              />
            </button>
            <button
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              style={{
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
                color: "black",
                padding: "2px 8px",
                minWidth: 32,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faTrash} size="lg" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const QuickTaskList = () => {
  const router = useRouter();
  function playTask(id) {
    router.push(`/focus/${id}`);
  }
  const [tasks, setTasks] = useState([]);
  const [taskCount, setTaskCount] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  // Default next_due to today (YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [newDue, setNewDue] = useState(todayStr);
  const [newRepeat, setNewRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [randomTaskId, setRandomTaskId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValuesMap, setEditValuesMap] = useState({});

  // Only use editValuesMap for editing
  function onEdit(id) {
    const t = tasks.find((task) => task.id === id);
    setEditingId(id);
    setEditValuesMap((prev) => ({
      ...prev,
      [id]: { title: t.title, due: t.due || "", repeat: t.repeat || "" },
    }));
  }

  function onCancelEdit() {
    setEditingId(null);
  }

  async function onSaveEdit(id) {
    setLoading(true);
    const vals = editValuesMap[id];
    const todayStr = new Date().toISOString().slice(0, 10);
    let next_due = vals.next_due;
    if (vals.repeat && !next_due) {
      next_due = todayStr;
    }
    if (!vals.repeat) {
      next_due = null;
    }
    const updateObj = {
      title: vals.title,
      next_due,
      repeat: typeof vals.repeat === "string" ? vals.repeat : null,
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

  // Helper to advance next_due based on repeat string (supports daily, weekly, N days, etc)
  function getNextDue(current, repeat) {
    if (!repeat) return null;
    const base = current ? new Date(current) : new Date();
    const rep = repeat.trim().toLowerCase();
    // Handle weekday names (e.g. mon, tue, fri)
    const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
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
    // fallback: just add 1 day
    base.setDate(base.getDate() + 1);
    return base.toISOString().slice(0, 10);
  }

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    fetchTasks();
  }, []);

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
    const today = new Date().toISOString().slice(0, 10);
    // Only include tasks that are unblocked and are visible (next_due today or no next_due)
    const visible = tasks.filter(
      (t) => !t.blocked && (!t.next_due || t.next_due === today)
    );
    if (visible.length === 0) return;
    const urgent = visible.filter((t) => t.urgent);
    const nonUrgent = visible.filter((t) => !t.urgent);
    let pool = visible;
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
            <div className={styles.quickTaskList}>
              {tasks
                .filter((task) => {
                  if (!task.next_due) return true;
                  // Only show if next_due is today
                  const today = new Date().toISOString().slice(0, 10);
                  return task.next_due === today;
                })
                .sort((a, b) => {
                  // Urgent tasks first
                  if (!!b.urgent - !!a.urgent !== 0)
                    return !!b.urgent - !!a.urgent;
                  // One-off (non-repeating) tasks next
                  if (!!a.repeat !== !!b.repeat) return !!a.repeat - !!b.repeat;
                  // Otherwise, keep original order (by id or order field)
                  return (a.order ?? a.id) - (b.order ?? b.id);
                })
                .map((task, idx) => (
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
