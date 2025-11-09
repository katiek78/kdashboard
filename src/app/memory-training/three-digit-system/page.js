"use client";
import ThreeDigitSystem from "@/components/ThreeDigitSystem";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function ThreeDigitSystemPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">3-Digit System</div>
        <ThreeDigitSystem />
      </main>
    </div>
  );
}
