"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import {
  fetchPlaces,
  addPlace,
  updatePlace,
  deletePlace,
  fetchPlaceById,
} from "../../utils/placesUtils";
import styles from "./page.module.css";

export default function PlacesPage() {
  const [places, setPlaces] = useState([]);
  const [parentIdStack, setParentIdStack] = useState([null]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: "World" }]);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);

  const parentId = parentIdStack[parentIdStack.length - 1];

  useEffect(() => {
    loadPlaces();
    // eslint-disable-next-line
  }, [parentId]);

  // Update breadcrumb when navigating
  useEffect(() => {
    async function updateBreadcrumb() {
      let crumbs = [{ id: null, name: "World" }];
      for (let i = 1; i < parentIdStack.length; i++) {
        const id = parentIdStack[i];
        if (id) {
          let place = places.find((p) => p.id === id);
          if (!place) {
            try {
              const data = await fetchPlaceById(id);
              if (data && data.name) {
                crumbs.push({ id, name: data.name });
              } else {
                crumbs.push({ id, name: "..." });
              }
            } catch {
              crumbs.push({ id, name: "..." });
            }
          } else {
            crumbs.push({ id, name: place.name });
          }
        }
      }
      setBreadcrumb(crumbs);
    }
    updateBreadcrumb();
    // eslint-disable-next-line
  }, [parentIdStack]);

  async function loadPlaces() {
    setLoading(true);
    try {
      const data = await fetchPlaces(parentId);
      setPlaces(data);
    } catch (err) {
      alert("Error loading places");
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newPlaceName.trim()) return;
    setLoading(true);
    try {
      await addPlace(newPlaceName, parentId);
      setNewPlaceName("");
      loadPlaces();
    } catch (err) {
      alert("Error adding place");
    }
    setLoading(false);
  }

  async function handleEdit(id) {
    setLoading(true);
    try {
      await updatePlace(id, editingName);
      setEditingId(null);
      setEditingName("");
      loadPlaces();
    } catch (err) {
      alert("Error updating place");
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this place?")) return;
    setLoading(true);
    try {
      await deletePlace(id);
      loadPlaces();
    } catch (err) {
      alert("Error deleting place");
    }
    setLoading(false);
  }

  function handleNavigate(id, name) {
    setParentIdStack([...parentIdStack, id]);
    setBreadcrumb([...breadcrumb, { id, name }]);
  }

  function handleBreadcrumbClick(idx) {
    setParentIdStack(parentIdStack.slice(0, idx + 1));
    setBreadcrumb(breadcrumb.slice(0, idx + 1));
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Places</div>

        <div className={styles.placesContainer + " pageContainer"}>
          <nav className={styles.breadcrumbNav}>
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
                    cursor:
                      idx === breadcrumb.length - 1 ? "default" : "pointer",
                    fontWeight:
                      idx === breadcrumb.length - 1 ? "bold" : "normal",
                  }}
                >
                  {crumb.name}
                </a>
                {idx < breadcrumb.length - 1 && <span> &gt; </span>}
              </span>
            ))}
          </nav>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Add new place"
              value={newPlaceName}
              onChange={(e) => setNewPlaceName(e.target.value)}
              style={{ marginRight: 8 }}
            />
            <button onClick={handleAdd} disabled={loading}>
              Add
            </button>
          </div>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {places.map((place) => (
                <li
                  key={place.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 8,
                    background: "#f7f7f7",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <span
                    style={{ flex: 1, cursor: "pointer" }}
                    onClick={() => handleNavigate(place.id, place.name)}
                  >
                    {editingId === place.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleEdit(place.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEdit(place.id);
                        }}
                        autoFocus
                      />
                    ) : (
                      place.name
                    )}
                  </span>
                  <button
                    title="Edit"
                    style={{
                      marginLeft: 8,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setEditingId(place.id);
                      setEditingName(place.name);
                    }}
                  >
                    <FontAwesomeIcon icon={faPen} style={{ color: "#333" }} />
                  </button>
                  <button
                    title="Delete"
                    style={{
                      marginLeft: 8,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "red",
                    }}
                    onClick={() => handleDelete(place.id)}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
