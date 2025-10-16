import { useState, useEffect } from "react";
import supabase from "@/utils/supabaseClient";
import styles from "./FoodMeals.module.css";

export default function FoodMeals() {
  const [meals, setMeals] = useState([]);
  const [newMeal, setNewMeal] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMeals();
  }, []);

  async function fetchMeals() {
    setLoading(true);
    const { data, error } = await supabase.from("meals").select();
    if (!error) setMeals(data);
    setLoading(false);
  }

  async function addMeal(e) {
    e.preventDefault();
    if (!newMeal.trim()) return;
    const { error } = await supabase.from("meals").insert({ name: newMeal });
    if (!error) {
      setNewMeal("");
      fetchMeals();
    }
  }

  async function deleteMeal(id) {
    await supabase.from("meals").delete().eq("id", id);
    fetchMeals();
  }

  async function startEdit(meal) {
    setEditingId(meal.id);
    setEditingName(meal.name);
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    await supabase.from("meals").update({ name: editingName }).eq("id", id);
    setEditingId(null);
    setEditingName("");
    fetchMeals();
  }

  return (
    <div className={styles.mealsContainer}>
      <h2 className={styles.title}>Meals</h2>
      <form onSubmit={addMeal} className={styles.addForm}>
        <input
          type="text"
          value={newMeal}
          onChange={(e) => setNewMeal(e.target.value)}
          placeholder="Add a meal..."
          className={styles.input}
        />
        <button type="submit" className={styles.addBtn}>
          Add
        </button>
      </form>
      {loading ? (
        <div>Loading meals...</div>
      ) : (
        <div className={styles.mealList}>
          {meals
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((meal) => (
              <div key={meal.id} className={styles.mealCard}>
                {editingId === meal.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className={styles.input}
                    />
                    <button
                      onClick={() => saveEdit(meal.id)}
                      className={styles.saveBtn}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className={styles.mealName}>{meal.name}</span>
                    <button
                      onClick={() => startEdit(meal)}
                      className={styles.editBtn}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMeal(meal.id)}
                      className={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
