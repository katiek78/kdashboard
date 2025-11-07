"use client";
import FourDigitSystem from "@/components/FourDigitSystem";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function FourDigitSystemPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">4-Digit System</div>
        <FourDigitSystem />
      </main>
    </div>
  );
}
