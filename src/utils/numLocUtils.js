import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchNumLoc(numString) {
  const { data, error } = await supabase
    .from("numberstrings")
    .select("*")
    .eq("num_string", numString)
    .maybeSingle(); // returns null if not found, no error
  if (error) return null;
  return data;
}

export async function upsertNumLoc({
  num_string,
  location,
  person,
  comp_image,
}) {
  const { data, error } = await supabase
    .from("numberstrings")
    .upsert([{ num_string, location, person, comp_image }], {
      onConflict: ["num_string"],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
