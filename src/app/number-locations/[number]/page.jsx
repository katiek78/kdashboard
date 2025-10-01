"use client";
import React, { useEffect, useState } from "react";
import styles from "../../../components/NumberLocationGallery.module.css";
import { useParams, useRouter } from "next/navigation";
import { fetchNumLoc, upsertNumLoc } from "../../../utils/numLocUtils";

const NumberLocationPage = () => {
  const params = useParams();
  const router = useRouter();
  const { number } = params;

  // Compute group start for back navigation (e.g., 175 -> 170)
  const numInt = parseInt(number, 10);
  const groupStart = Math.floor(numInt / 10) * 10;
  const groupLevel = number.length;

  const handleBackToGroup = () => {
    // Go back to the tile group for this number
    // e.g., for 175, go to gallery with level=3, startingDigits=17
    // We'll use query params for level/startingDigits
    router.push(
      `/number-locations?level=${groupLevel}&startingDigits=${Math.floor(
        numInt / 10
      )}`
    );
  };

  const [location, setLocation] = useState("");
  const [person, setPerson] = useState("");
  const [compImage, setCompImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const data = await fetchNumLoc(number.toString());
        if (!ignore && data) {
          setLocation(data.location || "");
          setPerson(data.person || "");
          setCompImage(data.comp_image || "");
        } else if (!ignore) {
          setLocation("");
          setPerson("");
          setCompImage("");
        }
      } catch {
        if (!ignore) setMessage("Error loading data");
      }
      setLoading(false);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [number]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await upsertNumLoc({
        num_string: number.toString(),
        location,
        person,
        comp_image: compImage,
      });
      setMessage("Saved!");
      setEditMode(false);
    } catch {
      setMessage("Error saving data");
    }
    setSaving(false);
  };

  // Handler for random number navigation
  const handleRandomNumber = () => {
    // Randomly pick a digit count (1-4)
    const digits = Math.floor(Math.random() * 4) + 1;
    // Random number in that range
    const max = Math.pow(10, digits) - 1;
    const min = digits === 1 ? 0 : Math.pow(10, digits - 1);
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    const numString = n.toString().padStart(digits, "0");
    router.push(`/number-locations/${numString}`);
  };

  return (
    <div className={styles.galleryContainer + " pageContainer"}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <button
          onClick={handleBackToGroup}
          style={{
            fontSize: 18,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#eee",
            color: "#333",
            cursor: "pointer",
          }}
        >
          Back to level
        </button>
        <h1
          style={{
            fontSize: 64,
            color: "#004d4d",
            textAlign: "center",
            margin: 0,
          }}
        >
          {number}
        </h1>
        <button
          onClick={handleRandomNumber}
          style={{
            fontSize: 18,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#008080",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Random Number
        </button>
      </div>
      <div
        style={{
          maxWidth: 480,
          margin: "40px auto",
          background: "rgba(255,255,255,0.85)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <label
                style={{
                  fontWeight: "bold",
                  fontSize: 28,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Location:
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 40,
                    marginTop: 4,
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                  }}
                  autoFocus
                />
              ) : (
                <div
                  style={{
                    fontSize: 48,
                    minHeight: 56,
                    fontWeight: 500,
                    color: location ? "#004d4d" : "#aaa",
                  }}
                >
                  {location || <span>(none)</span>}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 32 }}>
              <label
                style={{
                  fontWeight: "bold",
                  fontSize: 28,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Person:
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 40,
                    marginTop: 4,
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 48,
                    minHeight: 56,
                    fontWeight: 500,
                    color: person ? "#004d4d" : "#aaa",
                  }}
                >
                  {person || <span>(none)</span>}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 32 }}>
              <label
                style={{
                  fontWeight: "bold",
                  fontSize: 28,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Comp Image:
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={compImage}
                  onChange={(e) => setCompImage(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 40,
                    marginTop: 4,
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 48,
                    minHeight: 56,
                    fontWeight: 500,
                    color: compImage ? "#004d4d" : "#aaa",
                  }}
                >
                  {compImage || <span>(none)</span>}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              {editMode ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      fontSize: 16,
                      padding: "8px 20px",
                      borderRadius: 8,
                      background: "#008080",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    disabled={saving}
                    style={{
                      fontSize: 16,
                      padding: "8px 20px",
                      borderRadius: 8,
                      background: "#eee",
                      color: "#333",
                      border: "none",
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    fontSize: 16,
                    padding: "8px 20px",
                    borderRadius: 8,
                    background: "#eee",
                    color: "#333",
                    border: "none",
                  }}
                >
                  Edit
                </button>
              )}
            </div>
            {message && (
              <div
                style={{
                  marginTop: 16,
                  color: message === "Saved!" ? "green" : "red",
                }}
              >
                {message}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NumberLocationPage;
