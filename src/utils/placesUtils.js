export async function fetchPlaceById(id) {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, parent_id, flag_url")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchPlaces(parentId = null) {
  let query = supabase
    .from("places")
    .select("id, name, parent_id, flag_url")
    .order("name", { ascending: true });
  if (parentId === null) {
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", parentId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addPlace(name, parentId = null, flag_url = "") {
  const { data, error } = await supabase
    .from("places")
    .insert([{ name, parent_id: parentId, flag_url }])
    .select();
  if (error) throw error;
  return data[0];
}

export async function updatePlace(id, name, flag_url = "") {
  const { error } = await supabase
    .from("places")
    .update({ name, flag_url })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePlace(id) {
  const { error } = await supabase.from("places").delete().eq("id", id);
  if (error) throw error;
}
