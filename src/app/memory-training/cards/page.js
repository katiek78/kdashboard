"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

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
          <h1>Cards Training</h1>
          <p>
            This training tool is coming soon! Practice memorising shuffled card
            decks.
          </p>
          <div
            style={{
              padding: "20px",
              background: "#f8f9fa",
              borderRadius: "8px",
              marginTop: "20px",
            }}
          >
            <h3>Features to be added:</h3>
            <ul>
              <li>Full 52-card deck memorization</li>
              <li>Person-Action-Object (PAO) system integration</li>
              <li>Timing challenges</li>
              <li>Recall verification</li>
              <li>Statistics and improvement tracking</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
