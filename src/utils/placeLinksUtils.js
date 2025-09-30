import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fetch all links for a given place
export async function fetchPlaceLinks(placeId) {
  const { data, error } = await supabase
    .from("placelinks")
    .select("id, place_id, title, url, type")
    .eq("place_id", placeId)
    .order("title", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Add a new link to a place
export async function addPlaceLink(placeId, title, url, type) {
  const { data, error } = await supabase
    .from("placelinks")
    .insert([{ place_id: placeId, title, url, type }])
    .select();
  if (error) throw error;
  return data[0];
}

// Delete a link by id
export async function deletePlaceLink(linkId) {
  const { error } = await supabase.from("placelinks").delete().eq("id", linkId);
  if (error) throw error;
}
