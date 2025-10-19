"use client";
import { useState, useEffect } from "react";
import supabase from "@/utils/supabaseClient";
import styles from "./FoodMeals.module.css";

export default function MealPlanning() {
  const [meals, setMeals] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Get next 10 days (including today)
  const today = new Date();
  const days = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    // Format for display: 'Sun 19/10'
    const dayName = d.toLocaleDateString("en-GB", { weekday: "short" });
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const display = `${dayName} ${day}/${month}`;
    // Keep ISO for lookup
    return { iso: d.toISOString().slice(0, 10), display };
  });

  useEffect(() => {
    fetchMeals();
    fetchMealPlans();
  }, []);

  async function fetchMeals() {
    const { data, error } = await supabase.from("meals").select();
    if (!error) setMeals(data);
  }

  async function fetchMealPlans() {
    setLoading(true);
    const { data, error } = await supabase.from("meal_plans").select();
    if (!error) setMealPlans(data);
    setLoading(false);
  }

  async function handleAssignMeal(date, mealId) {
    setSaving(true);
    // Remove any existing plan for this date
    const existing = mealPlans.find((mp) => mp.planned_date === date);
    if (existing) {
      await supabase.from("meal_plans").delete().eq("id", existing.id);
    }
    // Add new plan
    await supabase
      .from("meal_plans")
      .insert({ meal_id: mealId, planned_date: date });
    fetchMealPlans();
    setSaving(false);
  }

  function getMealName(mealId) {
    const meal = meals.find((m) => m.id === mealId);
    return meal ? meal.name : "";
  }

  return (
    <div className={styles.mealsContainer}>
      <h2 className={styles.title}>Meal Planning</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className={styles.mealList}>
          {days.map((date) => {
            const plan = mealPlans.find((mp) => mp.planned_date === date.iso);
            return (
              <div key={date.iso} className={styles.mealCard}>
                <div className={styles.mealHeader}>
                  <span className={styles.mealName}>{date.display}</span>
                  <div className={styles.mealActions}>
                    <select
                      value={plan?.meal_id || ""}
                      onChange={(e) =>
                        handleAssignMeal(date.iso, e.target.value)
                      }
                      className={styles.input}
                      disabled={saving}
                    >
                      <option value="">Select meal...</option>
                      {meals.map((meal) => (
                        <option key={meal.id} value={meal.id}>
                          {meal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {plan && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <strong>Planned meal:</strong> {getMealName(plan.meal_id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
