"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import TrainingCoordinator from "@/components/TrainingCoordinator";

export default function CardTrainingPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Cards Training</div>
        <div className="pageContainer">
          <TrainingCoordinator discipline="cards" title="Card Deck Training" />
        </div>
      </main>
    </div>
  );
}
