"use client";
import React, { useEffect, useState } from "react";
import styles from "./NumberPage.module.css";
import { useParams, useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { fetchNumLoc, upsertNumLoc } from "../../../utils/numLocUtils";

const NumberLocationPage = () => {
  const params = useParams();
  const router = useRouter();
  const loadingAuth = useAuthRedirect();

  const { number } = params;

  // Compute group start for back navigation (e.g., 175 -> 170)
  const numInt = parseInt(number, 10);
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
  const [locationView, setLocationView] = useState("");

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
          setLocationView(data.location_view || "");
        } else if (!ignore) {
          setLocation("");
          setPerson("");
          setCompImage("");
          setLocationView("");
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

  if (loadingAuth) {
    return <div>Loading...</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await upsertNumLoc({
        num_string: number.toString(),
        location,
        person,
        comp_image: compImage,
        location_view: locationView,
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
        className={styles.numberHeaderContainer}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 8,
          flexWrap: "wrap",
          padding: "0 8px",
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
        <h1 className={styles.numberHeader}>{number}</h1>
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
      <div className={styles.responsiveWhiteSection}>
        {/* Location name at the top */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: location ? "#004d4d" : "#aaa",
            textAlign: "center",
            marginBottom: 24,
            minHeight: 44,
          }}
        >
          {editMode ? (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: "100%",
                fontSize: 32,
                fontWeight: 600,
                color: "#004d4d",
                textAlign: "center",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "8px 12px",
                margin: 0,
                background: "#fff",
              }}
              placeholder="(no location name)"
              autoFocus
            />
          ) : (
            location || <span>(no location name)</span>
          )}
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              {editMode ? (
                <>
                  <label
                    style={{
                      fontWeight: "bold",
                      fontSize: 28,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Street View (Paste coordinates, full URL, or embed URL):
                  </label>
                  <input
                    type="text"
                    value={locationView}
                    onChange={(e) => setLocationView(e.target.value)}
                    style={{
                      width: "100%",
                      fontSize: 24,
                      marginTop: 4,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ccc",
                    }}
                    placeholder="e.g. 51.5074,-0.1278 or https://www.google.com/maps/embed?... or https://www.google.com/maps/@?..."
                  />
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 28,
                      minHeight: 36,
                      color: locationView ? "#004d4d" : "#aaa",
                    }}
                  >
                    {!locationView && <span>(none)</span>}
                  </div>
                  {/* Show Street View if possible */}
                  {locationView &&
                    (() => {
                      const val = locationView.trim();
                      // 1. Embed URL
                      if (
                        val.startsWith("https://www.google.com/maps/embed?")
                      ) {
                        return (
                          <div
                            style={{
                              marginTop: 16,
                              borderRadius: 12,
                              overflow: "hidden",
                            }}
                          >
                            <iframe
                              src={val}
                              width="100%"
                              height="320"
                              style={{ border: 0, borderRadius: 12 }}
                              allowFullScreen
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="Street View"
                            />
                          </div>
                        );
                      }
                      // 2. Full Street View URL (e.g. https://www.google.com/maps/@.../data=!3m1!1e3)
                      if (val.startsWith("https://www.google.com/maps/@")) {
                        // Try to extract lat,lng from the URL
                        const match = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (match) {
                          const coords = `${match[1]},${match[2]}`;
                          return (
                            <div
                              style={{
                                marginTop: 16,
                                borderRadius: 12,
                                overflow: "hidden",
                              }}
                            >
                              <iframe
                                src={`https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
                                  coords
                                )}&cbp=11,0,0,0,0&output=svembed`}
                                width="100%"
                                height="320"
                                style={{ border: 0, borderRadius: 12 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Street View"
                              />
                            </div>
                          );
                        }
                      }
                      // 2b. /place/.../@lat,lng,... URLs
                      const placeMatch = val.match(
                        /\/@(\-?\d+\.\d+),(\-?\d+\.\d+)/
                      );
                      if (placeMatch) {
                        const coords = `${placeMatch[1]},${placeMatch[2]}`;
                        return (
                          <div
                            style={{
                              marginTop: 16,
                              borderRadius: 12,
                              overflow: "hidden",
                            }}
                          >
                            <iframe
                              src={`https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
                                coords
                              )}&cbp=11,0,0,0,0&output=svembed`}
                              width="100%"
                              height="320"
                              style={{ border: 0, borderRadius: 12 }}
                              allowFullScreen
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="Street View"
                            />
                          </div>
                        );
                      }
                      // 3. Coordinates
                      if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(val)) {
                        return (
                          <div
                            style={{
                              marginTop: 16,
                              borderRadius: 12,
                              overflow: "hidden",
                            }}
                          >
                            <iframe
                              src={`https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
                                val
                              )}&cbp=11,0,0,0,0&output=svembed`}
                              width="100%"
                              height="320"
                              style={{ border: 0, borderRadius: 12 }}
                              allowFullScreen
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="Street View"
                            />
                          </div>
                        );
                      }
                      // Fallback: not recognized
                      return null;
                    })()}
                </>
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
