"use client";
import { useState, useEffect } from "react";
import supabase from "../utils/supabaseClient";
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

function SortableQTLItem({ id, title, onDelete, highlight }) {
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
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span>{title}</span>
      <button onClick={() => onDelete(id)}>Delete</button>
    </div>
  );
}

const QuickTaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [randomTaskId, setRandomTaskId] = useState(null);

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
    const { data, error } = await supabase
      .from("quicktasks")
      .select("*")
      .order("order", { ascending: true });
    if (!error) setTasks(data);
    setLoading(false);
  }

  async function addTask() {
    if (!newTitle.trim()) return;
    // Find the highest order value
    const maxOrder =
      tasks.length > 0 ? Math.max(...tasks.map((t) => t.order)) : 0;
    const nextOrder = maxOrder + 1;
    const { error } = await supabase
      .from("quicktasks")
      .insert([{ title: newTitle, order: nextOrder }]);
    if (!error) {
      setNewTitle("");
      fetchTasks();
    }
  }

  async function deleteTask(id) {
    setLoading(true);
    await supabase.from("quicktasks").delete().eq("id", id);
    fetchTasks();
  }

  function pickRandomTask() {
    if (tasks.length === 0) return;
    const randomIdx = Math.floor(Math.random() * tasks.length);
    setRandomTaskId(tasks[randomIdx].id);
  }

  return (
    <div className={styles.taskContainer}>
      <div>
        <input
          type="text"
          placeholder="Task name"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button onClick={addTask}>Add Task</button>
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
                  onDelete={deleteTask}
                  highlight={task.id === randomTaskId}
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
