"use client";

import React, { useEffect, useState } from "react";
import styles from "./NumberPage.module.css";
import { useParams, useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { fetchNumLoc, upsertNumLoc } from "../../../utils/numLocUtils";
import { getNumberPhonetics } from "../../../utils/memTrainingUtils";

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
  const [categoryImage, setCategoryImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [message, setMessage] = useState("");
  const [locationView, setLocationView] = useState("");
  const [compImagePic, setCompImagePic] = useState("");
  const [phonetics, setPhonetics] = useState("");

  useEffect(() => {
    let ignore = false;

    // Compute phonetics for 4-digit numbers
    let phonetics = "";
    setPhonetics(getNumberPhonetics(number));

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const data = await fetchNumLoc(number.toString());
        if (!ignore && data) {
          setLocation(data.location || "");
          setPerson(data.person || "");
          setCompImage(data.comp_image || "");
          setCategoryImage(data.category_image || "");
          setLocationView(data.location_view || "");
          setCompImagePic(data.comp_image_pic || "");
        } else if (!ignore) {
          setLocation("");
          setPerson("");
          setCompImage("");
          setCategoryImage("");
          setLocationView("");
          setCompImagePic("");
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

  // (No normalization on entering edit mode; only normalize on save)

  // Normalize the Street View input to store only the minimal form
  const normalizeLocationView = (input) => {
    let val = input.trim();
    // If iframe HTML, extract src and return ONLY the src (do not keep the HTML)
    if (val.startsWith("<iframe")) {
      const srcMatch = val.match(/src=["']([^"']+)["']/);
      if (srcMatch && srcMatch[1]) {
        val = srcMatch[1];
      } else {
        // If no src found, treat as empty
        return "";
      }
    }
    // If embed URL, keep as is
    if (val.startsWith("https://www.google.com/maps/embed?")) {
      return val;
    }
    // If full Street View URL, extract lat,lng
    if (val.startsWith("https://www.google.com/maps/@")) {
      const match = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        return `${match[1]},${match[2]}`;
      }
    }
    // /place/.../@lat,lng,... URLs
    const placeMatch = val.match(/\/@(\-?\d+\.\d+),(\-?\d+\.\d+)/);
    if (placeMatch) {
      return `${placeMatch[1]},${placeMatch[2]}`;
    }
    // If coordinates in parentheses, e.g. (19.4432926, -99.1572926)
    const parenCoords = val.match(
      /^\(?\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)?$/
    );
    if (parenCoords) {
      return `${parenCoords[1]},${parenCoords[3]}`;
    }
    // If already coordinates
    if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(val)) {
      return val;
    }
    // Fallback: store as is, but if it was iframe HTML, this will now be just the src or empty
    return val;
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const normalizedLocationView = normalizeLocationView(locationView);
      await upsertNumLoc({
        num_string: number.toString(),
        location,
        person,
        comp_image: compImage,
        category_image: categoryImage,
        location_view: normalizedLocationView,
        comp_image_pic: compImagePic,
      });
      setMessage("Saved!");
      setEditMode(false);
      setLocationView(normalizedLocationView); // update input to normalized after save
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

  // Navigation handlers for Previous, Next, Up, Down
  const handlePrev = () => {
    const digits = number.length;
    let n = parseInt(number, 10) - 1;
    if (n < 0) {
      n = 0;
    }
    const numString = n.toString().padStart(digits, "0");
    router.push(`/number-locations/${numString}`);
  };

  const handleNext = () => {
    const digits = number.length;
    let n = parseInt(number, 10) + 1;
    const max = Math.pow(10, digits) - 1;
    if (n > max) {
      n = max;
    }
    const numString = n.toString().padStart(digits, "0");
    router.push(`/number-locations/${numString}`);
  };

  const handleUp = () => {
    // Remove last digit (unless only 1 digit)
    if (number.length === 1) return;
    const upNum = number.slice(0, -1);
    router.push(`/number-locations/${upNum}`);
  };

  const handleDown = () => {
    // Add a zero at the end
    const downNum = number + "0";
    router.push(`/number-locations/${downNum}`);
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <button
              onClick={handleUp}
              style={{
                fontSize: 18,
                padding: "4px 10px",
                borderRadius: 8,
                border: "none",
                background: "#eee",
                color: "#333",
                cursor: number.length === 1 ? "not-allowed" : "pointer",
              }}
              disabled={number.length === 1}
            >
              ↑
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handlePrev}
              style={{
                fontSize: 18,
                padding: "4px 10px",
                borderRadius: 8,
                border: "none",
                background: "#eee",
                color: "#333",
                cursor: "pointer",
              }}
            >
              ←
            </button>
            <h1 className={styles.numberHeader} style={{ margin: 0 }}>
              {number}
            </h1>
            <button
              onClick={handleNext}
              style={{
                fontSize: 18,
                padding: "4px 10px",
                borderRadius: 8,
                border: "none",
                background: "#eee",
                color: "#333",
                cursor: "pointer",
              }}
            >
              →
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={handleDown}
              style={{
                fontSize: 18,
                padding: "4px 10px",
                borderRadius: 8,
                border: "none",
                background: "#eee",
                color: "#333",
                cursor: "pointer",
              }}
            >
              ↓
            </button>
          </div>
        </div>
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
                  {/* Show Street View with comp_image_pic overlay if possible */}
                  {locationView &&
                    (() => {
                      let val = locationView.trim();
                      // If user pasted an iframe HTML, extract the src attribute
                      if (val.startsWith("<iframe")) {
                        const srcMatch = val.match(/src=["']([^"']+)["']/);
                        if (srcMatch && srcMatch[1]) {
                          val = srcMatch[1];
                        }
                      }
                      // Helper to render the iframe with overlay if compImagePic exists
                      const renderIframeWithOverlay = (iframeSrc) => (
                        <div
                          style={{
                            marginTop: 16,
                            borderRadius: 12,
                            overflow: "hidden",
                            position: "relative",
                            width: "100%",
                          }}
                        >
                          <iframe
                            src={iframeSrc}
                            width="100%"
                            height="320"
                            style={{
                              border: 0,
                              borderRadius: 12,
                              display: "block",
                              width: "100%",
                            }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Street View"
                          />
                          {compImagePic && (
                            <img
                              src={compImagePic}
                              alt="Comp Image Overlay"
                              className={styles.compImageOverlay}
                            />
                          )}
                        </div>
                      );
                      // 1. Embed URL
                      if (
                        val.startsWith("https://www.google.com/maps/embed?")
                      ) {
                        return renderIframeWithOverlay(val);
                      }
                      // 2. Full Street View URL (e.g. https://www.google.com/maps/@.../data=!3m1!1e3)
                      if (val.startsWith("https://www.google.com/maps/@")) {
                        const match = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (match) {
                          const coords = `${match[1]},${match[2]}`;
                          return renderIframeWithOverlay(
                            `https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
                              coords
                            )}&cbp=11,0,0,0,0&output=svembed`
                          );
                        }
                      }
                      // 2b. /place/.../@lat,lng,... URLs
                      const placeMatch = val.match(
                        /\/@(\-?\d+\.\d+),(\-?\d+\.\d+)/
                      );
                      if (placeMatch) {
                        const coords = `${placeMatch[1]},${placeMatch[2]}`;
                        return renderIframeWithOverlay(
                          `https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
                            coords
                          )}&cbp=11,0,0,0,0&output=svembed`
                        );
                      }
                      // 3. Coordinates (with or without parentheses and spaces)
                      const coordMatch = val.match(
                        /^\(?\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)?$/
                      );
                      if (coordMatch) {
                        const coords = `${coordMatch[1]},${coordMatch[3]}`;
                        return renderIframeWithOverlay(
                          `https://www.google.com/maps?q=&layer=c&cbll=${encodeURIComponent(
                            coords
                          )}&cbp=11,0,0,0,0&output=svembed`
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
            <div style={{ marginBottom: 32 }}>
              <label
                style={{
                  fontWeight: "bold",
                  fontSize: 28,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Category Image:
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={categoryImage}
                  onChange={(e) => setCategoryImage(e.target.value)}
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
                    color: categoryImage ? "#004d4d" : "#aaa",
                  }}
                >
                  {categoryImage || <span>(none)</span>}
                </div>
              )}
            </div>
            {editMode && (
              <div style={{ marginBottom: 32 }}>
                <label
                  style={{
                    fontWeight: "bold",
                    fontSize: 28,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Comp Image Pic (URL):
                </label>
                <input
                  type="text"
                  value={compImagePic}
                  onChange={(e) => setCompImagePic(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 24,
                    marginTop: 4,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                  }}
                  placeholder="https://... (image URL)"
                />
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <label
                style={{
                  fontWeight: "bold",
                  fontSize: 22,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Phonetics:
              </label>
              <div
                style={{
                  fontSize: 22,
                  minHeight: 28,
                  color: phonetics ? "#004d4d" : "#aaa",
                  fontStyle: phonetics ? "normal" : "italic",
                }}
              >
                {phonetics || <span>(none)</span>}
              </div>
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
