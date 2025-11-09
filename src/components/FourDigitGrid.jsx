import React, { useEffect, useState, useCallback, useMemo } from "react";
import supabase from "../utils/supabaseClient";

const FourDigitGrid = React.memo(function FourDigitGrid({
  refresh,
  onEditClick,
  onUpdateCallback,
}) {
  const [categoryImages, setCategoryImages] = useState({});
  const [compImages, setCompImages] = useState({});
  const [numberStrings, setNumberStrings] = useState({});
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState("00"); // first two digits

  // Generate the 100 numbers for the current prefix
  const numbers = useMemo(() => {
    return Array.from(
      { length: 100 },
      (_, i) => `${prefix}${i.toString().padStart(2, "0")}`
    );
  }, [prefix]);

  // Callback to update individual entries without full refresh
  const updateSingleEntry = useCallback((numString, type, newValue) => {
    if (type === "comp") {
      setCompImages((prev) => ({
        ...prev,
        [numString]: {
          ...prev[numString],
          num_string: numString,
          comp_image: newValue,
        },
      }));
    } else {
      setCategoryImages((prev) => ({
        ...prev,
        [numString]: {
          ...prev[numString],
          num_string: numString,
          category_image: newValue,
        },
      }));
    }
  }, []);

  useEffect(() => {
    async function fetchImages() {
      setLoading(true);

      // Fetch category_images for specific number list
      const { data: catImgs, error: catErr } = await supabase
        .from("category_images")
        .select("num_string,category_image")
        .in("num_string", numbers);

      // Fetch comp_images for specific number list
      const { data: compImgs, error: compErr } = await supabase
        .from("comp_images")
        .select("num_string,comp_image")
        .in("num_string", numbers);

      // Fetch numberstrings for location and person data
      const { data: numStrings, error: numErr } = await supabase
        .from("numberstrings")
        .select("num_string,location,person")
        .in("num_string", numbers);

      if (catErr) {
        console.error("Error fetching category images:", catErr);
      }
      if (compErr) {
        console.error("Error fetching comp images:", compErr);
      }
      if (numErr) {
        console.error("Error fetching number strings:", numErr);
      }

      // Map by num_string for fast lookup
      const catMap = {};
      (catImgs || []).forEach((img) => {
        if (img?.num_string) catMap[img.num_string] = img;
      });

      const compMap = {};
      (compImgs || []).forEach((img) => {
        if (img?.num_string) compMap[img.num_string] = img;
      });

      const numStringsMap = {};
      (numStrings || []).forEach((numStr) => {
        if (numStr?.num_string) numStringsMap[numStr.num_string] = numStr;
      });

      setCategoryImages(catMap);
      setCompImages(compMap);
      setNumberStrings(numStringsMap);
      setLoading(false);
    }
    fetchImages();
  }, [refresh, numbers]);

  // Register the update callback with parent component
  useEffect(() => {
    if (onUpdateCallback) {
      onUpdateCallback(updateSingleEntry);
    }
  }, [onUpdateCallback, updateSingleEntry]);

  if (loading) return <div>Loading grid...</div>;

  // Render table for selected prefix
  return (
    <div style={{ overflowX: "auto", maxHeight: "80vh" }}>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="prefix-select">Select first two digits: </label>
        <select
          id="prefix-select"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        >
          {Array.from({ length: 100 }, (_, i) =>
            i.toString().padStart(2, "0")
          ).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <table
        style={{
          borderCollapse: "collapse",
          fontSize: "13px",
          minWidth: "1000px",
        }}
      >
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
              Number
            </th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
              Location
            </th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
              Person
            </th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
              Category Image
            </th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px" }}>
              Comp Image
            </th>
          </tr>
        </thead>
        <tbody>
          {numbers.map((num) => {
            const catImg = categoryImages[num];
            const compImg = compImages[num];
            const numString = numberStrings[num];
            return (
              <tr key={num}>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    fontWeight: "bold",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  {num}
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    backgroundColor: numString?.location ? "#f0f8ff" : "#fff",
                  }}
                >
                  {numString?.location || ""}
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    backgroundColor: numString?.person ? "#f0f8ff" : "#fff",
                  }}
                >
                  {numString?.person || ""}
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    backgroundColor: catImg?.category_image
                      ? "#e8f5e8"
                      : "#fff5f5",
                  }}
                >
                  {catImg?.category_image || ""}
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    cursor: "pointer",
                    backgroundColor: compImg?.comp_image
                      ? "#e8f5e8"
                      : "#fff5f5",
                  }}
                  onClick={() => onEditClick?.(num, compImg?.comp_image || "")}
                  title="Click to edit"
                >
                  {compImg?.comp_image || ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default FourDigitGrid;
