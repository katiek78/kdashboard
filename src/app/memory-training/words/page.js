"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import TrainingCoordinator from "@/components/TrainingCoordinator";

export default function WordListsTrainingPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Word Lists Training</div>
        <div className="pageContainer">
          <TrainingCoordinator discipline="words" title="Word Lists Training" />
        </div>
      </main>
    </div>
  );
}
