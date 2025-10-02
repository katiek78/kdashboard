import React, { useEffect, useState } from "react";
import { fetchAllCategoryImages } from "../utils/categoryImagesUtils";
import { fetchAllCompImages } from "../utils/compImagesUtils";

export default function FourDigitGrid() {
  const [categoryImages, setCategoryImages] = useState({});
  const [compImages, setCompImages] = useState({});
  const [loading, setLoading] = useState(true);

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
  }, []);

  // Show all 10,000 numbers, with any available labels
  const numbers = Array.from({ length: 10000 }, (_, i) =>
    i.toString().padStart(4, "0")
  );

  if (loading) return <div>Loading grid...</div>;

  // Render full table
  return (
    <div style={{ overflowX: "auto", maxHeight: "80vh" }}>
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
