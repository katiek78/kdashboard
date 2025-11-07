"use client";
import PiMatrixView from "@/components/PiMatrixView";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function PiPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Pi</div>
        <PiMatrixView />
        <div className="pageContainer" style={{ marginTop: "40px" }}>
          <div
            style={{
              padding: "20px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #e9ecef",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#495057" }}>
              Training Features Coming Soon
            </h3>
            <ul style={{ color: "#666", marginBottom: 0 }}>
              <li>Interactive pi digit practice modes</li>
              <li>Chunked learning (5-digit, 10-digit groups)</li>
              <li>Progress tracking and statistics</li>
              <li>Speed challenges and competitions</li>
              <li>Visual memory aids and mnemonics</li>
              <li>Spaced repetition system</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
