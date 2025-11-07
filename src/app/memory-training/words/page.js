"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

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
          <h1>Word Lists Training</h1>
          <p>This training tool is coming soon! Memorize random word lists.</p>
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
              <li>Random word generation</li>
              <li>Customizable list lengths</li>
              <li>Story method assistance</li>
              <li>Memory palace integration</li>
              <li>Recall testing and scoring</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
