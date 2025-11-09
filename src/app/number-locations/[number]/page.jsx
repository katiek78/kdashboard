"use client";

import React, { useEffect, useState } from "react";
import styles from "./NumberPage.module.css";
import { useParams, useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import {
  fetchNumLoc,
  upsertNumLoc,
  fetchRandomNumberWithoutCompImage,
  debugSpecificNumber,
} from "../../../utils/numLocUtils";
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
  const [fourDigitBenTricky, setFourDigitBenTricky] = useState(false);
  const [directNumberInput, setDirectNumberInput] = useState("");

  // Track original values to detect changes
  const [originalValues, setOriginalValues] = useState({});

  useEffect(() => {
    let ignore = false;

    // Compute phonetics for 4-digit numbers
    let phonetics = "";
    setPhonetics(getNumberPhonetics(number));

    async function load() {
      setLoading(true);
      setMessage("");

      // DEBUG: Check what's actually in the database for this number
      if (number.length === 3) {
        await debugSpecificNumber(number.toString());
      }

      try {
        const data = await fetchNumLoc(number.toString());
        if (!ignore && data) {
          const values = {
            location: data.location || "",
            person: data.person || "",
            comp_image: data.comp_image || "",
            category_image: data.category_image || "",
            location_view: data.location_view || "",
            comp_image_pic: data.comp_image_pic || "",
            four_digit_ben_tricky: data.four_digit_ben_tricky || false,
          };
          setLocation(values.location);
          setPerson(values.person);
          setCompImage(values.comp_image);
          setCategoryImage(values.category_image);
          setLocationView(values.location_view);
          setCompImagePic(values.comp_image_pic);
          setFourDigitBenTricky(values.four_digit_ben_tricky);
          setOriginalValues(values);
          console.log("Setting original values:", values);
        } else if (!ignore) {
          const emptyValues = {
            location: "",
            person: "",
            comp_image: "",
            category_image: "",
            location_view: "",
            comp_image_pic: "",
            four_digit_ben_tricky: false,
          };
          setLocation("");
          setPerson("");
          setCompImage("");
          setCategoryImage("");
          setLocationView("");
          setCompImagePic("");
          setFourDigitBenTricky(false);
          setOriginalValues(emptyValues);
          console.log("Setting empty original values:", emptyValues);
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

    // Prevent saving if original values haven't been loaded yet
    if (!originalValues || Object.keys(originalValues).length === 0) {
      setMessage("Please wait for data to load before saving");
      setSaving(false);
      return;
    }

    try {
      const normalizedLocationView = normalizeLocationView(locationView);
      const payload = {
        num_string: number.toString(),
      };

      // Only include fields that have actually changed
      if (location.trim() !== originalValues.location) {
        payload.location = location.trim();
      }
      if (person.trim() !== originalValues.person) {
        payload.person = person.trim();
      }
      if (compImage.trim() !== originalValues.comp_image) {
        payload.comp_image = compImage.trim();
      }
      if (normalizedLocationView.trim() !== originalValues.location_view) {
        payload.location_view = normalizedLocationView.trim();
      }
      if (compImagePic.trim() !== originalValues.comp_image_pic) {
        payload.comp_image_pic = compImagePic.trim();
      }
      if (fourDigitBenTricky !== originalValues.four_digit_ben_tricky) {
        payload.four_digit_ben_tricky = fourDigitBenTricky;
      }

      // Only include category_image for 4-digit numbers and only if it has changed
      if (
        number.length === 4 &&
        categoryImage.trim() !== originalValues.category_image
      ) {
        payload.category_image = categoryImage.trim();
      }

      console.log("Payload being sent:", payload);
      console.log("Original values:", originalValues);
      console.log("Current categoryImage:", categoryImage.trim());
      console.log("Original categoryImage:", originalValues.category_image);

      await upsertNumLoc(payload);
      setMessage("Saved!");
      setEditMode(false);
      setLocationView(normalizedLocationView); // update input to normalized after save

      // Update original values after successful save
      setOriginalValues({
        location: location.trim(),
        person: person.trim(),
        comp_image: compImage.trim(),
        category_image: categoryImage.trim(),
        location_view: normalizedLocationView.trim(),
        comp_image_pic: compImagePic.trim(),
        four_digit_ben_tricky: fourDigitBenTricky,
      });
    } catch (error) {
      console.error("Save error:", error);
      setMessage(`Error saving data: ${error.message || error}`);
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

  // Handler for random number without comp_image navigation
  const handleRandomNumberWithoutCompImage = async () => {
    try {
      setMessage("Finding random number without comp image...");
      const randomNumString = await fetchRandomNumberWithoutCompImage(number);
      router.push(`/number-locations/${randomNumString}`);
    } catch (error) {
      console.error("Error finding random number without comp_image:", error);
      setMessage("Error: " + error.message);
    }
  };

  // Handler for "Mark as tricky" functionality
  const handleMarkAsTricky = async () => {
    if (number.length === 4) {
      setCompImage(categoryImage);
      setFourDigitBenTricky(true);

      // Save immediately
      setSaving(true);
      setMessage("");

      try {
        const payload = {
          num_string: number.toString(),
          comp_image: categoryImage.trim(),
          four_digit_ben_tricky: true,
        };

        await upsertNumLoc(payload);
        setMessage("Marked as tricky and saved!");

        // Update original values after successful save
        setOriginalValues((prev) => ({
          ...prev,
          comp_image: categoryImage.trim(),
          four_digit_ben_tricky: true,
        }));
      } catch (error) {
        console.error("Save error:", error);
        setMessage(`Error saving tricky status: ${error.message || error}`);
      }
      setSaving(false);
    }
  };

  // Handler for "Mark as not tricky" functionality
  const handleMarkAsNotTricky = async () => {
    if (number.length === 4) {
      setFourDigitBenTricky(false);

      // Save immediately
      setSaving(true);
      setMessage("");

      try {
        const payload = {
          num_string: number.toString(),
          four_digit_ben_tricky: false,
        };

        await upsertNumLoc(payload);
        setMessage("Marked as not tricky and saved!");

        // Update original values after successful save
        setOriginalValues((prev) => ({
          ...prev,
          four_digit_ben_tricky: false,
        }));
      } catch (error) {
        console.error("Save error:", error);
        setMessage(`Error saving tricky status: ${error.message || error}`);
      }
      setSaving(false);
    }
  };

  // Handler for direct number navigation
  const handleDirectNumberGo = () => {
    const input = directNumberInput.trim();
    if (
      input &&
      /^\d+$/.test(input) &&
      input.length >= 1 &&
      input.length <= 4
    ) {
      const paddedNumber = input.padStart(input.length, "0");
      router.push(`/number-locations/${paddedNumber}`);
    }
  };

  // Handle Enter key in direct number input
  const handleDirectNumberKeyPress = (e) => {
    if (e.key === "Enter") {
      handleDirectNumberGo();
    }
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
      <div className={styles.compactWhiteSection}>
        {/* Compact header with navigation and main number */}
        <div className={styles.compactHeader}>
          <button onClick={handleBackToGroup} className={styles.backButton}>
            ← Back
          </button>

          <div className={styles.centerSection}>
            <div className={styles.navigationGrid}>
              <button
                onClick={handleUp}
                className={`${styles.navButton} ${
                  number.length === 1 ? styles.navButtonDisabled : ""
                }`}
                disabled={number.length === 1}
              >
                ↑
              </button>
              <div className={styles.navRow}>
                <button onClick={handlePrev} className={styles.navButton}>
                  ←
                </button>
                <h1
                  className={`${styles.compactNumberHeader} ${
                    fourDigitBenTricky && number.length === 4
                      ? styles.numberHeaderTricky
                      : ""
                  }`}
                >
                  {number}
                </h1>
                <button onClick={handleNext} className={styles.navButton}>
                  →
                </button>
              </div>
              <button onClick={handleDown} className={styles.navButton}>
                ↓
              </button>
            </div>
          </div>

          <div className={styles.compactRightSection}>
            <div className={styles.directNumberContainer}>
              <input
                type="text"
                value={directNumberInput}
                onChange={(e) => setDirectNumberInput(e.target.value)}
                onKeyPress={handleDirectNumberKeyPress}
                placeholder="Go to..."
                className={styles.directNumberInput}
                maxLength={4}
              />
              <button
                onClick={handleDirectNumberGo}
                className={styles.goButton}
                disabled={
                  !directNumberInput.trim() ||
                  !/^\d+$/.test(directNumberInput.trim())
                }
              >
                Go
              </button>
            </div>
            <button
              onClick={handleRandomNumber}
              className={styles.randomButton}
            >
              Random
            </button>
            <button
              onClick={handleRandomNumberWithoutCompImage}
              className={styles.randomButton}
              title="Go to a random number that doesn't have a comp image"
            >
              Random Gap
            </button>
          </div>
        </div>

        {/* Location name */}
        <div
          className={`${styles.compactLocationName} ${
            !location && !editMode ? styles.locationNameEmpty : ""
          } ${
            fourDigitBenTricky && number.length === 4
              ? styles.locationNameTricky
              : ""
          }`}
        >
          {editMode ? (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={styles.compactLocationInput}
              placeholder="(no location name)"
              autoFocus
            />
          ) : loading ? (
            <span>Loading location...</span>
          ) : (
            <>
              {fourDigitBenTricky && number.length === 4 && (
                <span className={styles.trickyBadge}>TRICKY</span>
              )}
              {location || <span>(no location name)</span>}
            </>
          )}
        </div>

        <div className={styles.compactContent}>
          {/* Two-column layout */}
          <div className={styles.twoColumnLayout}>
            {/* Left column - Street View */}
            <div className={styles.leftColumn}>
              {editMode ? (
                <>
                  <label className={styles.compactLabel}>Street View:</label>
                  <input
                    type="text"
                    value={locationView}
                    onChange={(e) => setLocationView(e.target.value)}
                    className={styles.compactInput}
                    placeholder="Coordinates or URL"
                  />
                </>
              ) : (
                <>
                  {loading ? (
                    <div className={styles.loadingPlaceholder}>
                      <div className={styles.loadingText}>
                        Loading Street View...
                      </div>
                    </div>
                  ) : (
                    locationView &&
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
                        <div className={styles.compactStreetViewContainer}>
                          <iframe
                            src={iframeSrc}
                            width="100%"
                            height="300"
                            className={styles.streetViewIframe}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Street View"
                          />
                          {compImagePic && (
                            <img
                              src={compImagePic}
                              alt="Comp Image Overlay"
                              className={styles.compactCompImageOverlay}
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
                    })()
                  )}
                  {!loading && !locationView && (
                    <div className={styles.noStreetView}>No Street View</div>
                  )}
                </>
              )}
            </div>

            {/* Right column - Details */}
            <div className={styles.rightColumn}>
              <div className={styles.compactField}>
                <label className={styles.compactLabel}>Person:</label>
                {editMode ? (
                  <input
                    type="text"
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    className={styles.compactInput}
                  />
                ) : loading ? (
                  <div className={styles.compactValue}>Loading...</div>
                ) : (
                  <div
                    className={`${styles.compactValue} ${
                      !person ? styles.compactValueEmpty : ""
                    }`}
                  >
                    {person || <span>(none)</span>}
                  </div>
                )}
              </div>

              <div className={styles.compactField}>
                <label className={styles.compactLabel}>
                  Comp Image:
                  {fourDigitBenTricky &&
                    number.length === 4 &&
                    compImage === categoryImage && (
                      <span className={styles.trickyIndicator}>
                        {" "}
                        (from category)
                      </span>
                    )}
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={compImage}
                    onChange={(e) => setCompImage(e.target.value)}
                    className={styles.compactInput}
                  />
                ) : loading ? (
                  <div className={styles.compactValue}>Loading...</div>
                ) : (
                  <div
                    className={`${styles.compactValue} ${
                      !compImage ? styles.compactValueEmpty : ""
                    } ${
                      fourDigitBenTricky &&
                      number.length === 4 &&
                      compImage === categoryImage
                        ? styles.fieldValueTricky
                        : ""
                    }`}
                  >
                    {compImage || <span>(none)</span>}
                  </div>
                )}
              </div>

              {number.length === 4 && (
                <div className={styles.compactField}>
                  <label className={styles.compactLabel}>Category Image:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={categoryImage}
                      onChange={(e) => setCategoryImage(e.target.value)}
                      className={styles.compactInput}
                    />
                  ) : loading ? (
                    <div className={styles.compactValue}>Loading...</div>
                  ) : (
                    <div
                      className={`${styles.compactValue} ${
                        !categoryImage ? styles.compactValueEmpty : ""
                      }`}
                    >
                      {categoryImage || <span>(none)</span>}
                    </div>
                  )}
                </div>
              )}

              {editMode && (
                <div className={styles.compactField}>
                  <label className={styles.compactLabel}>Comp Image Pic:</label>
                  <input
                    type="text"
                    value={compImagePic}
                    onChange={(e) => setCompImagePic(e.target.value)}
                    className={styles.compactInput}
                    placeholder="https://... (image URL)"
                  />
                </div>
              )}

              <div className={styles.compactField}>
                <label className={styles.compactLabel}>Phonetics:</label>
                {loading ? (
                  <div className={styles.compactValue}>Loading...</div>
                ) : (
                  <div
                    className={`${styles.compactValue} ${
                      !phonetics ? styles.compactValueEmpty : ""
                    }`}
                  >
                    {phonetics || <span>(none)</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.compactActionButtons}>
            {editMode ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={styles.saveButton}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  disabled={saving}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className={styles.editButton}
                >
                  Edit
                </button>
                {number.length === 4 && (
                  <>
                    {!fourDigitBenTricky && categoryImage && (
                      <button
                        onClick={handleMarkAsTricky}
                        disabled={saving}
                        className={styles.trickyButton}
                        title="Copy category image to comp image and mark as tricky"
                      >
                        {saving ? "Saving..." : "Mark as Tricky"}
                      </button>
                    )}
                    {fourDigitBenTricky && (
                      <button
                        onClick={handleMarkAsNotTricky}
                        disabled={saving}
                        className={styles.notTrickyButton}
                        title="Remove tricky marking"
                      >
                        {saving ? "Saving..." : "Mark as Not Tricky"}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {message && (
            <div
              className={`${styles.message} ${
                message === "Saved!"
                  ? styles.messageSuccess
                  : styles.messageError
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NumberLocationPage;
