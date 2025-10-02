"use client";
import GeoGuessrContainer from "@/components/GeoGuessrContainer";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function GeoGuessrPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">GeoGuessr</div>
        <GeoGuessrContainer />
      </main>
    </div>
  );
}
