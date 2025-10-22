"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import TaskTags from "@/components/TaskTags";

export default function TagsPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <TaskTags />
      </main>
    </div>
  );
}
