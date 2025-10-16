"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

import styles from "./page.module.css";
import FoodMeals from "@/components/FoodMeals";
import Link from "next/link";

export default function FoodPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Food</div>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <Link href="/ingredients">
            <span
              style={{
                color: "#d97706",
                fontWeight: "bold",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Go to Ingredients Page
            </span>
          </Link>
        </div>
        <div className={`pageContainer ${styles.foodContainer}`}>
          <div className={styles.foodEmojis}>🍕</div>
          <div className={styles.foodEmojis}>🍔</div>
          <div className={styles.foodEmojis}>🍎</div>
          <div className={styles.foodEmojis}>🥕</div>
          {/* FoodMeals component for meal CRUD */}
          <FoodMeals />
        </div>
      </main>
    </div>
  );
}
