// Utilities for interacting with the comp_images table in Supabase
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE = "comp_images";

export async function fetchCompImage(num_string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("num_string,comp_image")
    .eq("num_string", num_string)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function fetchAllCompImages() {
  // Fetch all comp images
  const { data, error } = await supabase
    .from(TABLE)
    .select("num_string,comp_image");
  if (error) throw error;
  return data;
}
