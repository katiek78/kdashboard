import React, { useEffect, useState, useCallback, useMemo } from "react";
import supabase from "../utils/supabaseClient";

const FourDigitGrid = React.memo(function FourDigitGrid({
  refresh,
  onEditClick,
  // onUpdateCallback removed
  onDataUpdate,
  searchTerm = "",
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

  // Inline editing state
  const [editingCell, setEditingCell] = useState(null); // {num, field}
  const [editValue, setEditValue] = useState("");

  // Removed unused updateSingleEntry callback

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

  // Removed callback registration effect

  // Update parent with current grid data when data changes

  useEffect(() => {
    if (onDataUpdate && !loading) {
      const gridData = numbers.map((num) => ({
        number: num,
        location: numberStrings[num]?.location || "",
        person: numberStrings[num]?.person || "",
        categoryImage: categoryImages[num]?.category_image || "",
        compImage: compImages[num]?.comp_image || "",
      }));
      onDataUpdate(gridData);
    }
  }, [onDataUpdate, numbers, categoryImages, compImages, numberStrings, loading]);

  // Filtering logic (must be before any early return)
  const filteredNumbers = useMemo(() => {
    if (!searchTerm.trim()) return numbers;
    const term = searchTerm.trim().toLowerCase();
    return numbers.filter((num) => {
      const catImg = categoryImages[num]?.category_image || "";
      const compImg = compImages[num]?.comp_image || "";
      const loc = numberStrings[num]?.location || "";
      const person = numberStrings[num]?.person || "";
      return (
        num.toLowerCase().includes(term) ||
        catImg.toLowerCase().includes(term) ||
        compImg.toLowerCase().includes(term) ||
        loc.toLowerCase().includes(term) ||
        person.toLowerCase().includes(term)
      );
    });
  }, [searchTerm, numbers, categoryImages, compImages, numberStrings]);

  if (loading) return <div>Loading grid...</div>;

  // Inline save handler
  const handleCellSave = async (num, field) => {
    const value = editValue;
    setEditingCell(null);
    if (field === "location" || field === "person") {
      // Update numberstrings table
      await supabase
        .from("numberstrings")
        .update({ [field]: value })
        .eq("num_string", num);
      setNumberStrings((prev) => ({
        ...prev,
        [num]: { ...prev[num], [field]: value },
      }));
    } else if (field === "category_image") {
      // Update category_images table
      await supabase
        .from("category_images")
        .upsert({ num_string: num, category_image: value });
      setCategoryImages((prev) => ({
        ...prev,
        [num]: { ...prev[num], num_string: num, category_image: value },
      }));
    } else if (field === "comp_image") {
      // Update comp_images table
      await supabase
        .from("comp_images")
        .upsert({ num_string: num, comp_image: value });
      setCompImages((prev) => ({
        ...prev,
        [num]: { ...prev[num], num_string: num, comp_image: value },
      }));
    }
    setEditValue("");
  };

  // Render table for selected prefix or filtered results
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
          {filteredNumbers.map((num) => {
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
                {/* Location cell */}
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    backgroundColor: numString?.location ? "#f0f8ff" : "#fff",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setEditingCell({ num, field: "location" });
                    setEditValue(numString?.location || "");
                  }}
                  title="Click to edit"
                >
                  {editingCell &&
                  editingCell.num === num &&
                  editingCell.field === "location" ? (
                    <input
                      type="text"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleCellSave(num, "location")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCellSave(num, "location");
                        if (e.key === "Escape") setEditingCell(null);
                      }}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    numString?.location || (
                      <span style={{ color: "#bbb" }}>—</span>
                    )
                  )}
                </td>
                {/* Person cell */}
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    backgroundColor: numString?.person ? "#f0f8ff" : "#fff",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setEditingCell({ num, field: "person" });
                    setEditValue(numString?.person || "");
                  }}
                  title="Click to edit"
                >
                  {editingCell &&
                  editingCell.num === num &&
                  editingCell.field === "person" ? (
                    <input
                      type="text"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleCellSave(num, "person")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCellSave(num, "person");
                        if (e.key === "Escape") setEditingCell(null);
                      }}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    numString?.person || (
                      <span style={{ color: "#bbb" }}>—</span>
                    )
                  )}
                </td>
                {/* Category Image cell */}
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    backgroundColor: catImg?.category_image
                      ? "#e8f5e8"
                      : "#fff5f5",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setEditingCell({ num, field: "category_image" });
                    setEditValue(catImg?.category_image || "");
                  }}
                  title="Click to edit"
                >
                  {editingCell &&
                  editingCell.num === num &&
                  editingCell.field === "category_image" ? (
                    <input
                      type="text"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleCellSave(num, "category_image")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleCellSave(num, "category_image");
                        if (e.key === "Escape") setEditingCell(null);
                      }}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    catImg?.category_image || (
                      <span style={{ color: "#bbb" }}>—</span>
                    )
                  )}
                </td>
                {/* Comp Image cell */}
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    backgroundColor: compImg?.comp_image
                      ? "#e8f5e8"
                      : "#fff5f5",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setEditingCell({ num, field: "comp_image" });
                    setEditValue(compImg?.comp_image || "");
                  }}
                  title="Click to edit"
                >
                  {editingCell &&
                  editingCell.num === num &&
                  editingCell.field === "comp_image" ? (
                    <input
                      type="text"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleCellSave(num, "comp_image")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleCellSave(num, "comp_image");
                        if (e.key === "Escape") setEditingCell(null);
                      }}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    compImg?.comp_image || (
                      <span style={{ color: "#bbb" }}>—</span>
                    )
                  )}
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
