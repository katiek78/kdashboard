"use client";
import PiMatrixContainer from "@/components/PiMatrixContainer";
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
        <PiMatrixContainer />
      </main>
    </div>
  );
}
