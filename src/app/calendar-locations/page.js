"use client";

import CalendarLocationsContainer from "@/components/CalendarLocationsContainer";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function CalendarLocationsPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        {/* <div className="title">Calendar Locations</div> */}
        <CalendarLocationsContainer />
      </main>
    </div>
  );
}
