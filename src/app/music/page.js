"use client";

import MusicContainer from "@/components/MusicContainer";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function MusicPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Music</div>
        <MusicContainer />
      </main>
    </div>
  );
}
