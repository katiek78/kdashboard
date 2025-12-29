"use client";
import { useEffect, useState } from "react";
import supabase from "../utils/supabaseClient";

export default function CityNameEditor({ year }) {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("calendar_years")
      .select("city_name")
      .eq("year", year)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== "PGRST116") setError(error.message);
        setCity(data?.city_name || "");
        setLoading(false);
      });
  }, [year]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    const { error } = await supabase
      .from("calendar_years")
      .upsert(
        { year: Number(year), city_name: city },
        { onConflict: ["year"] }
      );
    if (error) setError(error.message);
    else setSuccess(true);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} style={{ marginBottom: "1.5rem" }}>
      <label style={{ fontWeight: 500 }}>
        City name for {year}:{" "}
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={loading || saving}
          style={{
            marginLeft: 8,
            padding: 4,
            borderRadius: 4,
            border: "1px solid #bbb",
          }}
        />
      </label>
      <button
        type="submit"
        disabled={loading || saving}
        style={{ marginLeft: 12 }}
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {error && <span style={{ color: "red", marginLeft: 12 }}>{error}</span>}
      {success && (
        <span style={{ color: "green", marginLeft: 12 }}>Saved!</span>
      )}
    </form>
  );
}
