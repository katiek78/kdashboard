"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import QuickTaskList from "@/components/QuickTaskList";
import Link from "next/link";

export default function TasksPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">
          Tasks
          <Link
            href="/tasks/board"
            style={{
              marginLeft: "20px",
              padding: "8px 16px",
              background: "#1976d2",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "normal",
            }}
          >
            Board View
          </Link>
        </div>
        <QuickTaskList />
      </main>
    </div>
  );
}
