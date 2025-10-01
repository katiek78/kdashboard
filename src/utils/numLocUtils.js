import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchNumLoc(numString) {
  // Fetch main numberstring row
  const { data: numData, error: numError } = await supabase
    .from("numberstrings")
    .select("*")
    .eq("num_string", numString)
    .maybeSingle();
  if (numError) return null;

  // Fetch comp_image from comp_images table
  const { data: compData, error: compError } = await supabase
    .from("comp_images")
    .select("comp_image")
    .eq("num_string", numString)
    .maybeSingle();
  if (compError) return null;

  return {
    ...numData,
    comp_image: compData ? compData.comp_image : "",
  };
}

export async function upsertNumLoc({
  num_string,
  location,
  person,
  comp_image,
}) {
  // Upsert numberstrings row (without comp_image)
  const { data: numData, error: numError } = await supabase
    .from("numberstrings")
    .upsert([{ num_string, location, person }], {
      onConflict: ["num_string"],
    })
    .select()
    .maybeSingle();
  if (numError) throw numError;

  // Upsert comp_image in comp_images table
  let compData = null;
  if (typeof comp_image !== "undefined") {
    const { data, error } = await supabase
      .from("comp_images")
      .upsert([{ num_string, comp_image }], {
        onConflict: ["num_string"],
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    compData = data;
  }

  return {
    ...numData,
    comp_image: compData ? compData.comp_image : comp_image,
  };
}
