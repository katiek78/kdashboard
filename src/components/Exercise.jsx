"use client";

import { useState, useEffect } from "react";
import styles from "./Exercise.module.css";
import supabase from "../utils/supabaseClient";

export default function Exercise() {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function fetchExercises() {
      setFetching(true);
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name")
        .order("id", { ascending: false });
      if (!error) setExercises(data || []);
      setFetching(false);
    }
    fetchExercises();
  }, []);

  async function refetchExercises() {
    const { data, error } = await supabase
      .from("exercises")
      .select("id, name")
      .order("id", { ascending: false });
    if (!error) setExercises(data || []);
  }

  async function handleAdd() {
    setError("");
    setSuccess(false);
    if (!name.trim()) {
      setError("Please enter an exercise name.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("exercises")
        .insert([{ name: name.trim() }]);
      if (error) throw error;
      setSuccess(true);
      setName("");
      await refetchExercises();
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
      }, 1000);
    } catch (e) {
      setError("Could not save exercise.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.exerciseContainer + " pageContainer"}>
      <h2 className={styles.heading}>Exercise</h2>
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setShowModal(true)}
        >
          Add exercise
        </button>
        <button type="button" className={styles.button}>
          Pick random exercise
        </button>
      </div>

      <div style={{ marginTop: 32, width: "100%", maxWidth: 400 }}>
        <h4 style={{ color: "#217a3a", marginBottom: 10, fontWeight: 600 }}>
          Your Exercises
        </h4>
        {fetching ? (
          <div>Loading...</div>
        ) : exercises.length === 0 ? (
          <div style={{ color: "#888" }}>No exercises yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {exercises.map((ex) => (
              <li
                key={ex.id}
                style={{
                  background: "#e6f9ec",
                  borderRadius: 7,
                  padding: "0.6rem 1rem",
                  marginBottom: 8,
                  color: "#217a3a",
                  fontWeight: 500,
                  fontSize: "1.08rem",
                  boxShadow: "0 1px 4px rgba(60,72,100,0.04)",
                }}
              >
                {ex.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "2rem 1.5rem",
              minWidth: 320,
              boxShadow: "0 4px 32px rgba(60, 72, 100, 0.13)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setShowModal(false);
                setName("");
                setError("");
                setSuccess(false);
              }}
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                background: "none",
                border: "none",
                fontSize: 22,
                color: "#888",
                cursor: "pointer",
                fontWeight: 700,
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h3 style={{ color: "#217a3a", marginBottom: 18, fontWeight: 700 }}>
              Add Exercise
            </h3>
            <input
              className={styles.input}
              type="text"
              placeholder="Exercise name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button
              className={styles.button}
              onClick={handleAdd}
              style={{ marginTop: 10, minWidth: 100 }}
              disabled={loading}
            >
              {loading ? "Adding..." : "Add"}
            </button>
            {success && (
              <div style={{ color: "#15803d", marginTop: 12 }}>
                Exercise added!
              </div>
            )}
            {error && (
              <div style={{ color: "#b91c1c", marginTop: 12 }}>{error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
