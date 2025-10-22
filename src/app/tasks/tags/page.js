"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import TaskTags from "@/components/TaskTags";
import Link from "next/link";

export default function TagsPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/tasks"
            style={{
              padding: "8px 16px",
              background: "#1976d2",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "normal",
            }}
          >
            ← Today View
          </Link>
        </div>
        <TaskTags />
      </main>
    </div>
  );
}
