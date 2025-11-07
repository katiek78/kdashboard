// Utilities for interacting with the comp_images table in Supabase
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE = "comp_images";

export async function fetchCompImage(num_string) {
  try {
    // Use regular select instead of .single() to avoid 406 errors
    const { data, error } = await supabase
      .from(TABLE)
      .select("num_string,comp_image")
      .eq("num_string", num_string)
      .limit(1);

    // Handle any Supabase errors gracefully
    if (error) {
      console.warn(`Failed to fetch comp image for ${num_string}:`, error);
      return null;
    }

    // Return the first result if found, otherwise null
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.warn(`Error fetching comp image for ${num_string}:`, err);
    return null;
  }
}

export async function fetchAllCompImages() {
  // Fetch all comp images
  const { data, error } = await supabase
    .from(TABLE)
    .select("num_string,comp_image");
  if (error) throw error;
  return data;
}
