"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../../utils/supabaseClient";
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

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <button
          onClick={() => router.push("/tasks")}
          className={styles.backButton}
        >
          ← Back to Today View
        </button>
        <h1>Task Board</h1>
      </div>

      <BoardView tasks={tasks} onTaskUpdate={handleTaskUpdate} />
    </div>
  );
};

export default BoardPage;
