"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import TrainingCoordinator from "@/components/TrainingCoordinator";

export default function NumberSequencesTrainingPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        {/* <div className="title">Number Sequences Training</div> */}
        <div className="pageContainer">
          <TrainingCoordinator discipline="numbers" title="Numbers Training" />
        </div>
      </main>
    </div>
  );
}
