export async function fetchPlaceById(id) {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, parent_id")
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
    .select("id, name, parent_id")
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

export async function addPlace(name, parentId = null) {
  const { data, error } = await supabase
    .from("places")
    .insert([{ name, parent_id: parentId }])
    .select();
  if (error) throw error;
  return data[0];
}

export async function updatePlace(id, name) {
  const { error } = await supabase.from("places").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deletePlace(id) {
  const { error } = await supabase.from("places").delete().eq("id", id);
  if (error) throw error;
}
