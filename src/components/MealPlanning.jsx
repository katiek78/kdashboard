"use client";
import { useState, useEffect } from "react";
import supabase from "@/utils/supabaseClient";
import styles from "./FoodMeals.module.css";
import Link from "next/link";

export default function MealPlanning() {
  const [addingNewMeal, setAddingNewMeal] = useState({}); // { dateIso: true/false }
  const [newMealName, setNewMealName] = useState("");
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
    const existing = mealPlans.find((mp) => mp.planned_date === date);
    if (existing) {
      // Update the existing plan
      await supabase
        .from("meal_plans")
        .update({ meal_id: mealId })
        .eq("id", existing.id);
    } else {
      // Add new plan
      await supabase
        .from("meal_plans")
        .insert({ meal_id: mealId, planned_date: date });
    }
    fetchMealPlans();
    setSaving(false);
  }

  async function handleAddNewMeal(date) {
    if (!newMealName.trim()) return;
    const { data, error } = await supabase
      .from("meals")
      .insert({ name: newMealName })
      .select();
    if (!error && data && data[0]) {
      await handleAssignMeal(date, data[0].id);
      setNewMealName("");
      setAddingNewMeal((prev) => ({ ...prev, [date]: false }));
      fetchMeals();
    }
  }

  function getMealName(mealId) {
    const meal = meals.find((m) => m.id === mealId);
    return meal ? meal.name : "";
  }

  return (
    <div className={styles.mealsContainer}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/food"
          style={{
            color: "#fbbf24",
            textDecoration: "underline",
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          ← Back to Food Page
        </Link>
      </div>
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
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setAddingNewMeal((prev) => ({
                            ...prev,
                            [date.iso]: true,
                          }));
                        } else {
                          setAddingNewMeal((prev) => ({
                            ...prev,
                            [date.iso]: false,
                          }));
                          handleAssignMeal(date.iso, e.target.value);
                        }
                      }}
                      className={styles.input}
                      disabled={saving}
                    >
                      <option value="">Select meal...</option>
                      <option value="__new__">Add new...</option>
                      {meals.map((meal) => (
                        <option key={meal.id} value={meal.id}>
                          {meal.name}
                        </option>
                      ))}
                    </select>
                    {addingNewMeal[date.iso] && (
                      <div style={{ display: "inline-block", marginLeft: 8 }}>
                        <input
                          type="text"
                          value={newMealName}
                          onChange={(e) => setNewMealName(e.target.value)}
                          placeholder="New meal name"
                          className={styles.input}
                          style={{ width: 140 }}
                        />
                        <button
                          className={styles.addBtn}
                          style={{ marginLeft: 8 }}
                          onClick={() => handleAddNewMeal(date.iso)}
                          disabled={!newMealName.trim()}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {plan && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <strong>Planned meal:</strong>{" "}
                    <Link
                      href={`/food?mealId=${plan.meal_id}`}
                      style={{
                        color: "#fbbf24",
                        textDecoration: "underline",
                        fontWeight: "bold",
                      }}
                    >
                      {getMealName(plan.meal_id)}
                    </Link>
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
