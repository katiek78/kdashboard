"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function NumberSequencesTrainingPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Number Sequences Training</div>
        <div className="pageContainer">
          <h1>Number Sequences Training</h1>
          <p>
            This training tool is coming soon! Practice with random number
            sequences.
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
              <li>Configurable sequence lengths</li>
              <li>Different number systems (decimal, binary)</li>
              <li>Speed training modes</li>
              <li>Progressive difficulty</li>
              <li>Performance analytics</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
