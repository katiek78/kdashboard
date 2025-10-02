import React, { useEffect, useState } from "react";
import { fetchPlaces, fetchPlaceById } from "../utils/placesUtils";

export default function GeoPlaces() {
  const [parentIdStack, setParentIdStack] = useState([null]);
  const [places, setPlaces] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: "World" }]);
  const [loading, setLoading] = useState(false);

  const parentId = parentIdStack[parentIdStack.length - 1];

  useEffect(() => {
    setLoading(true);
    fetchPlaces(parentId)
      .then((data) => setPlaces(data))
      .finally(() => setLoading(false));
  }, [parentId]);

  useEffect(() => {
    async function updateBreadcrumb() {
      let crumbs = [{ id: null, name: "World" }];
      for (let i = 1; i < parentIdStack.length; i++) {
        const id = parentIdStack[i];
        if (id) {
          let place;
          try {
            place = await fetchPlaceById(id);
          } catch {
            place = null;
          }
          crumbs.push({ id, name: place?.name || "..." });
        }
      }
      setBreadcrumb(crumbs);
    }
    updateBreadcrumb();
    // eslint-disable-next-line
  }, [parentIdStack]);

  function handleNavigate(id) {
    setParentIdStack([...parentIdStack, id]);
  }

  function handleBreadcrumbClick(idx) {
    setParentIdStack(parentIdStack.slice(0, idx + 1));
  }

  return (
    <div
      style={{
        marginBottom: "20px",
        paddingBottom: "10px",
        borderBottom: "1px solid #ccc",
      }}
    >
      <h3>Tips by Place</h3>
      <nav style={{ marginTop: 10, marginBottom: 12 }}>
        {breadcrumb.map((crumb, idx) => (
          <span key={crumb.id}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleBreadcrumbClick(idx);
              }}
              style={{
                color: idx === breadcrumb.length - 1 ? "#333" : "#0070f3",
                textDecoration:
                  idx === breadcrumb.length - 1 ? "none" : "underline",
                cursor: idx === breadcrumb.length - 1 ? "default" : "pointer",
                fontWeight: idx === breadcrumb.length - 1 ? "bold" : "normal",
              }}
            >
              {crumb.name}
            </a>
            {idx < breadcrumb.length - 1 && <span> &gt; </span>}
          </span>
        ))}
      </nav>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {places.map((place) => (
            <li key={place.id} style={{ marginBottom: 6 }}>
              <button
                style={{
                  background: "#e0f7fa",
                  border: "1px solid #b2f7cc",
                  borderRadius: 4,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontWeight: 500,
                  color: "#1a2b2b", // dark text for readability
                }}
                onClick={() => handleNavigate(place.id)}
              >
                {place.flag_url && (
                  <img
                    src={place.flag_url}
                    alt="flag"
                    style={{
                      width: 22,
                      height: 16,
                      objectFit: "cover",
                      borderRadius: 2,
                      marginRight: 6,
                      verticalAlign: "middle",
                    }}
                  />
                )}
                {place.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
