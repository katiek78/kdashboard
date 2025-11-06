import React, { useEffect, useState, useCallback } from "react";
import supabase from "../utils/supabaseClient";

const FourDigitGrid = React.memo(function FourDigitGrid({
  refresh,
  onUpdateCallback,
}) {
  const [categoryImages, setCategoryImages] = useState({});
  const [compImages, setCompImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState("00"); // first two digits

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
      // Only fetch the 100 for the current prefix
      const rangeStart = prefix + "00";
      const rangeEnd = prefix + "99";
      // Fetch category_images
      const { data: catImgs, error: catErr } = await supabase
        .from("category_images")
        .select("num_string,category_image")
        .gte("num_string", rangeStart)
        .lte("num_string", rangeEnd);
      // Fetch comp_images
      const { data: compImgs, error: compErr } = await supabase
        .from("comp_images")
        .select("num_string,comp_image")
        .gte("num_string", rangeStart)
        .lte("num_string", rangeEnd);
      // Map by num_string for fast lookup
      const catMap = {};
      (catImgs || []).forEach((img) => {
        if (img?.num_string) catMap[img.num_string] = img;
      });
      const compMap = {};
      (compImgs || []).forEach((img) => {
        if (img?.num_string) compMap[img.num_string] = img;
      });
      setCategoryImages(catMap);
      setCompImages(compMap);
      setLoading(false);
    }
    fetchImages();
  }, [refresh, prefix]);

  // Register the update callback with parent component
  useEffect(() => {
    if (onUpdateCallback) {
      onUpdateCallback(() => updateSingleEntry);
    }
  }, [onUpdateCallback, updateSingleEntry]);

  // Show only the 100 numbers for the selected prefix
  const numbers = Array.from(
    { length: 100 },
    (_, i) => `${prefix}${i.toString().padStart(2, "0")}`
  );

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
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f8f8",
                zIndex: 1,
              }}
            >
              Number
            </th>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f8f8",
                zIndex: 1,
              }}
            >
              Category Image
            </th>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f8f8",
                zIndex: 1,
              }}
            >
              Comp Image
            </th>
          </tr>
        </thead>
        <tbody>
          {numbers.map((numStr) => {
            const catLabel = categoryImages[numStr]?.category_image || "";
            const compLabel = compImages[numStr]?.comp_image || "";
            return (
              <tr key={numStr}>
                <td
                  style={{
                    border: "1px solid #eee",
                    padding: "2px 8px",
                    textAlign: "right",
                    fontFamily: "monospace",
                  }}
                >
                  {numStr}
                </td>
                <td
                  style={{
                    border: "1px solid #eee",
                    padding: "2px 8px",
                    textAlign: "center",
                  }}
                >
                  {catLabel}
                </td>
                <td
                  style={{
                    border: "1px solid #eee",
                    padding: "2px 8px",
                    textAlign: "center",
                  }}
                >
                  {compLabel}
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
