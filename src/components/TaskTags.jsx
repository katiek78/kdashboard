import { useState, useEffect } from "react";
import supabase from "@/utils/supabaseClient";
import styles from "./TaskTags.module.css";

export default function TaskTags() {
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState({ name: "", color: "#fbbf24" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    setLoading(true);
    const { data, error } = await supabase.from("task_tags").select();
    if (!error) setTags(data || []);
    setLoading(false);
  }

  async function handleAddTag() {
    if (!newTag.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("task_tags")
      .insert({ name: newTag.name, colour: newTag.color })
      .select();
    if (!error && data && data[0]) {
      setTags((prev) => [...prev, data[0]]);
      setNewTag({ name: "", color: "#fbbf24" });
    }
    setSaving(false);
  }

  return (
    <div className={styles.tagsContainer}>
      <h3 className={styles.title}>Task Tags</h3>
      <div className={styles.addTagForm}>
        <input
          type="text"
          placeholder="Tag name"
          value={newTag.name}
          onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
          className={styles.input}
        />
        <input
          type="color"
          value={newTag.color}
          onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
          className={styles.colorInput}
        />
        <button
          className={styles.addBtn}
          onClick={handleAddTag}
          disabled={!newTag.name.trim() || saving}
        >
          {saving ? "Saving..." : "Add"}
        </button>
      </div>
      <div className={styles.tagList}>
        {loading ? (
          <span>Loading...</span>
        ) : (
          tags.map((tag) => (
            <span
              key={tag.id}
              className={styles.tag}
              style={{ backgroundColor: tag.colour }}
            >
              {tag.name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
