// Utilities for interacting with the geoguessr tips table in Supabase
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE = "geoguessr";

export async function fetchTips({ tip_type, place_id } = {}) {
  let query = supabase.from(TABLE).select("*");
  if (tip_type) query = query.eq("tip_type", tip_type);
  if (place_id === null) {
    query = query.is("place_id", null);
  } else if (place_id) {
    query = query.eq("place_id", place_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addTip({
  tip_type,
  place_id,
  image_url,
  title,
  content,
}) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ tip_type, place_id, image_url, title, content }])
    .select();
  if (error) throw error;
  return data[0];
}

export async function updateTip(id, fields) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(fields)
    .eq("id", id)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteTip(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return true;
}
