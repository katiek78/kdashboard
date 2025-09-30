"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import QuickTaskList from "@/components/QuickTaskList";
import styles from "./task.module.css";

export default function TasksPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Tasks</div>
        <QuickTaskList />
      </main>
    </div>
  );
}
