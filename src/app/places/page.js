"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPen,
  faGlobe,
  faNewspaper,
  faPhotoFilm,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchPlaces,
  addPlace,
  updatePlace,
  deletePlace,
  fetchPlaceById,
} from "../../utils/placesUtils";
import {
  fetchPlaceLinks,
  addPlaceLink,
  deletePlaceLink,
} from "../../utils/placeLinksUtils";
import styles from "./page.module.css";

const LINK_TYPE_OPTIONS = [
  { value: "Media", label: "Media", icon: faPhotoFilm },
  { value: "News", label: "News", icon: faNewspaper },
  { value: "View", label: "View", icon: faGlobe },
];

export default function PlacesPage() {
  const [places, setPlaces] = useState([]);
  const [parentIdStack, setParentIdStack] = useState([null]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: "World" }]);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newFlagUrl, setNewFlagUrl] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingFlagUrl, setEditingFlagUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeLinks, setPlaceLinks] = useState([]);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkType, setNewLinkType] = useState("");
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editLinkTitle, setEditLinkTitle] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editLinkType, setEditLinkType] = useState("");

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
      await addPlace(newPlaceName, parentId, newFlagUrl);
      setNewPlaceName("");
      setNewFlagUrl("");
      loadPlaces();
    } catch (err) {
      alert("Error adding place");
    }
    setLoading(false);
  }

  async function handleEdit(id) {
    setLoading(true);
    try {
      await updatePlace(id, editingName, editingFlagUrl);
      setEditingId(null);
      setEditingName("");
      setEditingFlagUrl("");
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

  useEffect(() => {
    async function loadLinks() {
      if (parentId) {
        const links = await fetchPlaceLinks(parentId);
        setPlaceLinks(links);
      } else {
        setPlaceLinks([]);
      }
    }
    loadLinks();
  }, [parentId]);

  async function handleAddLink(e) {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim() || !newLinkType.trim())
      return;
    await addPlaceLink(parentId, newLinkTitle, newLinkUrl, newLinkType);
    setNewLinkTitle("");
    setNewLinkUrl("");
    setNewLinkType("");
    const links = await fetchPlaceLinks(parentId);
    setPlaceLinks(links);
  }

  async function handleDeleteLink(linkId) {
    await deletePlaceLink(linkId);
    const links = await fetchPlaceLinks(parentId);
    setPlaceLinks(links);
  }

  async function handleEditLink(link) {
    setEditingLinkId(link.id);
    setEditLinkTitle(link.title);
    setEditLinkUrl(link.url);
    setEditLinkType(link.type);
  }

  async function handleSaveEditLink(linkId) {
    await addPlaceLink(parentId, editLinkTitle, editLinkUrl, editLinkType); // You should implement an updatePlaceLink util for real update
    setEditingLinkId(null);
    setEditLinkTitle("");
    setEditLinkUrl("");
    setEditLinkType("");
    const links = await fetchPlaceLinks(parentId);
    setPlaceLinks(links);
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
          {/* Place Links Section */}
          {parentId && (
            <div style={{ margin: "16px 0" }}>
              <h4>Links</h4>
              <form
                onSubmit={handleAddLink}
                style={{ display: "flex", gap: 8, marginBottom: 8 }}
              >
                <input
                  type="text"
                  placeholder="Title"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  style={{ minWidth: 80 }}
                />
                <input
                  type="text"
                  placeholder="URL"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  style={{ minWidth: 120 }}
                />
                <select
                  value={newLinkType}
                  onChange={(e) => setNewLinkType(e.target.value)}
                  style={{ minWidth: 60 }}
                  required
                >
                  <option value="" disabled>
                    Select type
                  </option>
                  {LINK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button type="submit">Add</button>
              </form>
              {placeLinks.length > 0 && (
                <ul className={styles.placeLinksList}>
                  {placeLinks.map((link) => {
                    const typeObj = LINK_TYPE_OPTIONS.find(
                      (opt) => opt.value === link.type
                    );
                    const isEditing = editingLinkId === link.id;
                    return (
                      <li
                        key={link.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px",
                          marginBottom: 4,
                        }}
                      >
                        {typeObj && (
                          <FontAwesomeIcon
                            icon={typeObj.icon}
                            style={{ color: "#888" }}
                          />
                        )}
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editLinkTitle}
                              onChange={(e) => setEditLinkTitle(e.target.value)}
                              style={{ minWidth: 80 }}
                            />
                            <input
                              type="text"
                              value={editLinkUrl}
                              onChange={(e) => setEditLinkUrl(e.target.value)}
                              style={{ minWidth: 120 }}
                            />
                            <select
                              value={editLinkType}
                              onChange={(e) => setEditLinkType(e.target.value)}
                              style={{ minWidth: 60 }}
                            >
                              {LINK_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSaveEditLink(link.id)}
                              style={{
                                color: "#0070f3",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingLinkId(null)}
                              style={{
                                color: "#888",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {link.title}
                            </a>
                            <button
                              onClick={() => handleEditLink(link)}
                              style={{
                                color: "#0070f3",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                              }}
                              title="Edit"
                            >
                              <FontAwesomeIcon icon={faPen} />
                            </button>
                            <button
                              onClick={() => handleDeleteLink(link.id)}
                              style={{
                                color: "red",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                              }}
                              title="Delete"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          <div
            className={styles.placeInputRow}
            style={{
              display: "flex",
              gap: 2,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Add new place"
              value={newPlaceName}
              onChange={(e) => setNewPlaceName(e.target.value)}
              style={{ marginRight: 8 }}
            />
            <input
              type="text"
              placeholder="Flag image URL (optional)"
              value={newFlagUrl}
              onChange={(e) => setNewFlagUrl(e.target.value)}
              style={{ marginRight: 8, minWidth: 180 }}
              className={styles.flagUrlInput}
            />
            <button onClick={handleAdd} disabled={loading}>
              Add
            </button>
          </div>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <ul className={styles.placeList}>
              {places.map((place) => (
                <li
                  key={place.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 8,
                    padding: "8px 12px",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onClick={() => handleNavigate(place.id, place.name)}
                  >
                    {editingId === place.id ? (
                      <div className={styles.placeInputRow}>
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          style={{ marginRight: 8 }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                        />
                        <input
                          type="text"
                          placeholder="Flag image URL"
                          value={editingFlagUrl}
                          onChange={(e) => setEditingFlagUrl(e.target.value)}
                          style={{ minWidth: 120 }}
                          className={styles.flagUrlInput}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(place.id);
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        {place.flag_url && (
                          <img
                            src={place.flag_url}
                            alt="flag"
                            style={{
                              width: 24,
                              height: 18,
                              objectFit: "cover",
                              borderRadius: 2,
                              marginRight: 6,
                            }}
                          />
                        )}
                        {place.name}
                      </>
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
                      setEditingFlagUrl(place.flag_url || "");
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
