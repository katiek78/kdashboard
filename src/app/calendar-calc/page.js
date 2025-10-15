"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import styles from "./page.module.css";
import CalendarCalc from "@/components/CalendarCalc";

export default function CalendarCalcPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Calendar Calculation</div>
        <div className={`pageContainer ${styles.calendarContainer}`}>
          <div className={styles.calendarCard}>
            <CalendarCalc />
          </div>
        </div>
      </main>
    </div>
  );
}
