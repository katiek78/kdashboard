import React, { useEffect, useState } from "react";
import { fetchAllCategoryImages } from "../utils/categoryImagesUtils";
import { fetchAllCompImages } from "../utils/compImagesUtils";

export default function FourDigitGrid({ refresh }) {
  const [categoryImages, setCategoryImages] = useState({});
  const [compImages, setCompImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState("00"); // first two digits

  useEffect(() => {
    async function fetchImages() {
      setLoading(true);
      // Fetch all category and comp images at once (no in filter, no paging)
      const [catImgs, compImgs] = await Promise.all([
        fetchAllCategoryImages(),
        fetchAllCompImages(),
      ]);
      // Map by num_string for fast lookup
      const catMap = {};
      catImgs.forEach((img) => {
        if (img?.num_string) catMap[img.num_string] = img;
      });
      const compMap = {};
      compImgs.forEach((img) => {
        if (img?.num_string) compMap[img.num_string] = img;
      });
      setCategoryImages(catMap);
      setCompImages(compMap);
      setLoading(false);
    }
    fetchImages();
  }, [refresh]);

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
}
