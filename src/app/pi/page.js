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
      </main>
    </div>
  );
}
