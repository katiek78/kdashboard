"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import NumberLocationGallery from "@/components/NumberLocationGallery";

export default function NumberLocationsPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Number Locations</div>
        <NumberLocationGallery />
      </main>
    </div>
  );
}
