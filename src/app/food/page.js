"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import styles from "./page.module.css";

export default function FoodPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Food</div>
        <div className={`pageContainer ${styles.foodContainer}`}>
          <div className={styles.foodEmojis}>🍕</div>
          <div className={styles.foodEmojis}>🍔</div>
          <div className={styles.foodEmojis}>🍎</div>
          <div className={styles.foodEmojis}>🥕</div>
          {/* <div className={styles.foodCard}>
            <p>Food page content coming soon... 🍽️</p>
          </div> */}
        </div>
      </main>
    </div>
  );
}
