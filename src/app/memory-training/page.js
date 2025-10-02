"use client";
import MemoryTrainingContainer from "@/components/MemoryTrainingContainer";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function PiPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Memory Training</div>
        <MemoryTrainingContainer />
      </main>
    </div>
  );
}
