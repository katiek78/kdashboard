import { useState, useEffect } from "react";
import supabase from "@/utils/supabaseClient";
import styles from "./FoodMeals.module.css";
import MealPlanning from "./MealPlanning"; // Import MealPlanning component

// Helper to get ingredient name by id
function getIngredientName(ingredients, id) {
  const found = ingredients.find((ing) => ing.id === id);
  return found ? found.name : "";
}

export default function FoodMeals() {
  const [editingLastEaten, setEditingLastEaten] = useState({}); // { mealId: true/false }
  const [lastEatenInput, setLastEatenInput] = useState({}); // { mealId: date string }
  const [meals, setMeals] = useState([]);
  const [newMeal, setNewMeal] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [ingredientEditId, setIngredientEditId] = useState(null); // meal id for ingredient editing
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [addingNewIngredient, setAddingNewIngredient] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [mealIngredients, setMealIngredients] = useState({}); // { mealId: [ingredientId, ...] }
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [expandedIngredients, setExpandedIngredients] = useState({}); // { mealId: true/false }
  const [showMealPlanning, setShowMealPlanning] = useState(false); // State to control MealPlanning component visibility

  useEffect(() => {
    fetchMeals();
    fetchIngredients();
  }, []);

  useEffect(() => {
    if (meals.length > 0) {
      fetchMealIngredients();
    }
  }, [meals]);

  async function fetchMeals() {
    setLoading(true);
    const { data, error } = await supabase.from("meals").select();
    if (!error) setMeals(data);
    setLoading(false);
  }

  async function fetchIngredients() {
    setIngredientLoading(true);
    const { data, error } = await supabase.from("ingredients").select();
    if (!error) setIngredients(data);
    setIngredientLoading(false);
  }

  async function fetchMealIngredients() {
    // Get all meal_ingredients for all meals
    const { data, error } = await supabase.from("meal_ingredients").select();
    if (!error && data) {
      // Group by meal_id
      const grouped = {};
      data.forEach((row) => {
        if (!grouped[row.meal_id]) grouped[row.meal_id] = [];
        grouped[row.meal_id].push(row.ingredient_id);
      });
      setMealIngredients(grouped);
    }
  }

  // Add ingredient to a meal
  async function handleAddIngredient(mealId) {
    if (!selectedIngredient) return;
    // If adding new ingredient, handle separately
    if (selectedIngredient === "__new__") {
      if (!newIngredientName.trim()) return;
      // Add new ingredient
      const { data, error } = await supabase
        .from("ingredients")
        .insert({ name: newIngredientName })
        .select();
      if (!error && data && data[0]) {
        // Assign new ingredient to meal
        await supabase
          .from("meal_ingredients")
          .insert({ meal_id: mealId, ingredient_id: data[0].id });
        setNewIngredientName("");
        setAddingNewIngredient(false);
        setSelectedIngredient("");
        fetchIngredients();
        fetchMealIngredients();
      }
      return;
    }
    await supabase
      .from("meal_ingredients")
      .insert({ meal_id: mealId, ingredient_id: selectedIngredient });
    setSelectedIngredient("");
    fetchMealIngredients();
  }

  // Remove ingredient from a meal
  async function handleRemoveIngredient(mealId, ingredientId) {
    await supabase
      .from("meal_ingredients")
      .delete()
      .eq("meal_id", mealId)
      .eq("ingredient_id", ingredientId);
    fetchMealIngredients();
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
                <div className={styles.mealHeader}>
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
                      <div className={styles.mealHeaderMain}>
                        <span className={styles.mealName}>{meal.name}</span>
                      </div>
                      <div className={styles.mealHeaderLastEaten}>
                        <span style={{ fontSize: "0.95em", color: "#666" }}>
                          Last eaten:{" "}
                        </span>
                        {!editingLastEaten[meal.id] ? (
                          <>
                            {meal.last_eaten ? meal.last_eaten : <em>never</em>}
                            <button
                              className={styles.editBtn}
                              style={{
                                marginLeft: 8,
                                fontSize: "0.9em",
                                padding: "0.2em 0.7em",
                              }}
                              onClick={() => {
                                setEditingLastEaten((prev) => ({
                                  ...prev,
                                  [meal.id]: true,
                                }));
                                setLastEatenInput((prev) => ({
                                  ...prev,
                                  [meal.id]: meal.last_eaten || "",
                                }));
                              }}
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              type="date"
                              value={lastEatenInput[meal.id] || ""}
                              onChange={(e) =>
                                setLastEatenInput((prev) => ({
                                  ...prev,
                                  [meal.id]: e.target.value,
                                }))
                              }
                              style={{
                                fontSize: "1em",
                                padding: "0.2em 0.5em",
                              }}
                            />
                            <button
                              className={styles.saveBtn}
                              style={{
                                marginLeft: 6,
                                fontSize: "0.9em",
                                padding: "0.2em 0.7em",
                              }}
                              onClick={async () => {
                                await supabase
                                  .from("meals")
                                  .update({
                                    last_eaten: lastEatenInput[meal.id] || null,
                                  })
                                  .eq("id", meal.id);
                                setEditingLastEaten((prev) => ({
                                  ...prev,
                                  [meal.id]: false,
                                }));
                                fetchMeals();
                              }}
                              disabled={!lastEatenInput[meal.id]}
                            >
                              Save
                            </button>
                            <button
                              className={styles.cancelBtn}
                              style={{
                                marginLeft: 4,
                                fontSize: "0.9em",
                                padding: "0.2em 0.7em",
                              }}
                              onClick={() =>
                                setEditingLastEaten((prev) => ({
                                  ...prev,
                                  [meal.id]: false,
                                }))
                              }
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                      <div className={styles.mealActions}>
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
                        <button
                          onClick={() =>
                            setExpandedIngredients((prev) => ({
                              ...prev,
                              [meal.id]: !prev[meal.id],
                            }))
                          }
                          className={styles.editBtn}
                          style={{ marginLeft: "0.5rem" }}
                        >
                          {expandedIngredients[meal.id]
                            ? "Hide Ingredients"
                            : "Show Ingredients"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {/* Expanded ingredients section below mealHeader, inside mealCard */}
                {expandedIngredients[meal.id] && (
                  <div className={styles.ingredientSection}>
                    {mealIngredients[meal.id] &&
                    mealIngredients[meal.id].length > 0 ? (
                      <div className={styles.assignedIngredients}>
                        {mealIngredients[meal.id].map((id) => (
                          <div key={id} className={styles.ingredientCard}>
                            <span>{getIngredientName(ingredients, id)}</span>
                            <button
                              className={styles.removeBtn}
                              onClick={() =>
                                handleRemoveIngredient(meal.id, id)
                              }
                              title="Remove ingredient"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.assignedIngredients}>
                        <em>No ingredients assigned</em>
                      </div>
                    )}
                    <div className={styles.ingredientEditRow}>
                      <select
                        value={selectedIngredient}
                        onChange={(e) => {
                          setSelectedIngredient(e.target.value);
                          setAddingNewIngredient(e.target.value === "__new__");
                        }}
                        className={styles.input}
                      >
                        <option value="">Select ingredient...</option>
                        <option value="__new__">Add new...</option>
                        {ingredients
                          .filter(
                            (ing) => !mealIngredients[meal.id]?.includes(ing.id)
                          )
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((ingredient) => (
                            <option key={ingredient.id} value={ingredient.id}>
                              {ingredient.name}
                            </option>
                          ))}
                      </select>
                      {addingNewIngredient && (
                        <input
                          type="text"
                          value={newIngredientName}
                          onChange={(e) => setNewIngredientName(e.target.value)}
                          placeholder="New ingredient name"
                          className={styles.input}
                          style={{ marginLeft: 8, width: 140 }}
                        />
                      )}
                      <button
                        className={styles.addBtn}
                        style={{ marginLeft: 8 }}
                        onClick={() => handleAddIngredient(meal.id)}
                        disabled={
                          !selectedIngredient ||
                          (selectedIngredient === "__new__" &&
                            !newIngredientName.trim())
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
