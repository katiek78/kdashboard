"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import PlacesContainer from "@/components/PlacesContainer";

export default function PlacesPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Places</div>
        <PlacesContainer />
      </main>
    </div>
  );
}
