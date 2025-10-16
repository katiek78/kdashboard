"use client";
import { useState, useEffect } from "react";
import supabase from "@/utils/supabaseClient";
import styles from "./IngredientsList.module.css";

export default function IngredientsList() {
  const [ingredients, setIngredients] = useState([]);
  const [newName, setNewName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIngredients();
  }, []);

  async function fetchIngredients() {
    setLoading(true);
    const { data, error } = await supabase.from("ingredients").select();
    if (!error) setIngredients(data);
    setLoading(false);
  }

  async function addIngredient(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const { error } = await supabase
      .from("ingredients")
      .insert({ name: newName, image_url: newImageUrl || null });
    if (!error) {
      setNewName("");
      setNewImageUrl("");
      fetchIngredients();
    }
  }

  return (
    <div className={styles.ingredientsContainer}>
      <h2 className={styles.title}>Add Ingredient</h2>
      <form onSubmit={addIngredient} className={styles.addForm}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ingredient name..."
          className={styles.input}
        />
        <input
          type="text"
          value={newImageUrl}
          onChange={(e) => setNewImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className={styles.input}
        />
        <button type="submit" className={styles.addBtn}>
          Add
        </button>
      </form>
      <h2 className={styles.title}>Ingredients List</h2>
      {loading ? (
        <div>Loading ingredients...</div>
      ) : (
        <div className={styles.ingredientList}>
          {ingredients
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((ingredient) => (
              <div key={ingredient.id} className={styles.ingredientCard}>
                {ingredient.image_url && (
                  <img
                    src={ingredient.image_url}
                    alt={ingredient.name}
                    className={styles.ingredientImg}
                  />
                )}
                <span className={styles.ingredientName}>{ingredient.name}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
