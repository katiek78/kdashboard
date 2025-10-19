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
        <div className={`pageContainer ${styles.foodContainer}`}>
          <div className={styles.foodEmojis}>🍕</div>
          <div className={styles.foodEmojis}>🍔</div>
          <div className={styles.foodEmojis}>🍎</div>
          <div className={styles.foodEmojis}>🥕</div>
          {/* FoodMeals component for meal CRUD */}
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <Link href="/ingredients">
              <button
                style={{
                  background: "#fbbf24",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1.5rem",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                  marginBottom: "1rem",
                  marginRight: "1rem",
                }}
              >
                Go to Ingredients Page
              </button>
            </Link>
            <Link href="/food/planning">
              <button
                style={{
                  background: "#fbbf24",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1.5rem",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                  marginBottom: "1rem",
                }}
              >
                Go to Meal Planning
              </button>
            </Link>
          </div>
          <FoodMeals />
        </div>
      </main>
    </div>
  );
}
