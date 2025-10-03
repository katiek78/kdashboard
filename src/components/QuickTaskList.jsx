"use client";
import { useState, useEffect } from "react";
import supabase from "../utils/supabaseClient";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlay, faBan } from "@fortawesome/free-solid-svg-icons";
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
  due,
  repeat,
  blocked,
  onDelete,
  onPlay,
  onToggleBlocked,
  highlight,
  onEdit,
  isEditing,
  editValues,
  setEditValues,
  onSaveEdit,
  onCancelEdit,
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
    background: highlight ? "#ffe066" : "none",
    boxShadow: highlight ? "0 0 20px 5px #ffe066" : "none",
    border: highlight ? "2px solid #f79533" : "none",
    marginBottom: 4,
    padding: 4,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {isEditing ? (
        <>
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
              setEditValues((v) => ({ ...v, due: e.target.value }))
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
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button onClick={() => onSaveEdit(id)} style={{ marginRight: 2 }}>
              Save
            </button>
            <button onClick={onCancelEdit} style={{ marginRight: 8 }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <span
              {...listeners}
              style={{ marginRight: 8, display: "flex", alignItems: "center" }}
            >
              {title}
              {repeat ? (
                <span
                  style={{
                    fontSize: "0.95rem",
                    color: "#0a7",
                    background: "#eaffea",
                    borderRadius: 6,
                    padding: "2px 8px",
                    marginLeft: 8,
                    fontWeight: 600,
                    letterSpacing: 1,
                    display: "inline-block",
                  }}
                >
                  {repeat.toUpperCase()}
                </span>
              ) : null}
            </span>
            {due && (
              <span
                style={{ fontSize: "0.9rem", color: "#888", marginLeft: 8 }}
              >
                Due: {due}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <button onClick={() => onEdit(id)} style={{ marginRight: 2 }}>
              Edit
            </button>
            <button
              title={blocked ? "Unblock task" : "Block task"}
              onClick={() => onToggleBlocked(id, !blocked)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: blocked ? "#c00" : "#888",
                fontSize: 20,
                marginRight: 4,
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
              style={{ background: "none", border: "none", cursor: "pointer" }}
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
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "black",
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
    const unblocked = tasks.filter((t) => !t.blocked);
    if (unblocked.length === 0) return;
    const randomIdx = Math.floor(Math.random() * unblocked.length);
    setRandomTaskId(unblocked[randomIdx].id);
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
              {tasks.map((task) => (
                <SortableQTLItem
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  next_due={task.next_due}
                  repeat={task.repeat}
                  blocked={!!task.blocked}
                  onDelete={deleteTask}
                  onPlay={playTask}
                  onToggleBlocked={toggleBlocked}
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
