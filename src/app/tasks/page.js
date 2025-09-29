import styles from "./task.module.css";

export default function TasksPage() {
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
