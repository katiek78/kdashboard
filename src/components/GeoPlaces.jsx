import React, { useEffect, useState } from "react";
import { fetchPlaces, fetchPlaceById } from "../utils/placesUtils";
import { addTip, fetchTips, deleteTip } from "../utils/geoguessrUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import styles from "./GeoGuessrContainer.module.css";

export default function GeoPlaces() {
  const [parentIdStack, setParentIdStack] = useState([null]);
  const [places, setPlaces] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: "World" }]);
  const [loading, setLoading] = useState(false);
  // Tip form state
  const [tipType, setTipType] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  // Tips for current place
  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  // parentId must be defined before useEffect
  const parentId = parentIdStack[parentIdStack.length - 1];
  // Fetch tips for the current place
  useEffect(() => {
    // if (typeof parentId === "undefined") return;
    setTipsLoading(true);
    // For World, fetch tips with place_id null
    fetchTips({ place_id: parentId === null ? null : parentId })
      .then((data) => setTips(data))
      .finally(() => setTipsLoading(false));
  }, [parentId, adding]);

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

      {/* Tips for this place */}
      <div style={{ marginBottom: 18 }}>
        <strong>Tips</strong>
        {tipsLoading ? (
          <div>Loading tips...</div>
        ) : tips.length === 0 ? (
          <div style={{ color: "#888", fontStyle: "italic", marginTop: 4 }}>
            No tips for this location yet.
          </div>
        ) : (
          <ul style={{ paddingLeft: 0, listStyle: "none", marginTop: 6 }}>
            {tips.map((tip) => (
              <li
                key={tip.id}
                style={{
                  marginBottom: 12,
                  background: "#f8fff8",
                  border: "1px solid #b2f7cc",
                  borderRadius: 5,
                  padding: 10,
                  position: "relative",
                }}
              >
                <div className={styles.tipType}>
                  {tip.tip_type || (
                    <span style={{ color: "#bbb" }}>[No type]</span>
                  )}
                </div>
                {tip.title && (
                  <div className={styles.tipTitle}>{tip.title}</div>
                )}
                {tip.image_url && (
                  <div style={{ margin: "6px 0" }}>
                    <img
                      src={tip.image_url}
                      alt="tip"
                      style={{
                        maxWidth: 180,
                        maxHeight: 120,
                        borderRadius: 4,
                        border: "1px solid #eee",
                      }}
                    />
                  </div>
                )}
                {tip.content && (
                  <div style={{ whiteSpace: "pre-wrap", color: "#222" }}>
                    {tip.content}
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (window.confirm("Delete this tip?")) {
                      await deleteTip(tip.id);
                      setTips((prev) => prev.filter((t) => t.id !== tip.id));
                    }
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "none",
                    border: "none",
                    color: "#b71c1c",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                  title="Delete tip"
                  aria-label="Delete tip"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setAdding(true);
          setAddError("");
          try {
            await addTip({
              tip_type: tipType,
              place_id: parentId === null ? null : parentId,
              image_url: imageUrl,
              title: title,
              content: content,
            });
            setTipType("");
            setImageUrl("");
            setTitle("");
            setContent("");
          } catch (err) {
            setAddError(err.message || "Error adding tip");
          }
          setAdding(false);
        }}
        style={{
          marginBottom: 18,
          background: "#f6fff8",
          border: "1px solid #b2f7cc",
          borderRadius: 6,
          padding: 12,
          maxWidth: 500,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <label>
            Tip Type:
            <input
              type="text"
              value={tipType}
              onChange={(e) => setTipType(e.target.value)}
              style={{ marginLeft: 8, minWidth: 120 }}
              required
            />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Image URL:
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ marginLeft: 8, minWidth: 180 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Title:
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ marginLeft: 8, minWidth: 180 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Content:
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={styles.tipContentTextarea}
            />
          </label>
        </div>
        {addError && (
          <div style={{ color: "red", marginBottom: 8 }}>{addError}</div>
        )}
        <button type="submit" disabled={adding}>
          {adding ? "Adding..." : "Add Tip"}
        </button>
      </form>

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
