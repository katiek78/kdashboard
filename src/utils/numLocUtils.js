import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchNumLoc(numString) {
  // Fetch numberstrings row
  const { data: numData, error: numError } = await supabase
    .from("numberstrings")
    .select("*")
    .eq("num_string", numString)
    .maybeSingle();
  if (numError || !numData) return null;

  // Fetch comp_image from comp_images table
  let compImage = "";
  const { data: compData, error: compError } = await supabase
    .from("comp_images")
    .select("comp_image")
    .eq("num_string", numString)
    .maybeSingle();
  if (!compError && compData && compData.comp_image) {
    compImage = compData.comp_image;
  }

  return {
    ...numData,
    comp_image: compImage,
  };
}

export async function upsertNumLoc({
  num_string,
  location,
  person,
  comp_image,
  location_view,
}) {
  const { data, error } = await supabase
    .from("numberstrings")
    .upsert([{ num_string, location, person, location_view }], {
      onConflict: ["num_string"],
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
