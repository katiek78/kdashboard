"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import styles from "./task.module.css";

export default function TasksPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Tasks</h1>
        <div className={styles.taskContainer}>
          {/* Task list component would go here */}
          Something
        </div>
      </main>
    </div>
  );
}
