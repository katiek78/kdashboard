"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function NamesFacesTrainingPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Name & Face Training</div>
        <div className="pageContainer">
          <h1>Name & Face Training</h1>
          <p>
            This training tool is coming soon! Practice memorizing names and
            faces.
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
              <li>Random face and name pairings</li>
              <li>Multiple choice and free recall modes</li>
              <li>Batch learning (groups of 10, 20, 50)</li>
              <li>Difficulty levels</li>
              <li>Progress tracking and spaced repetition</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
