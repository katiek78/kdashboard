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

  // Fetch comp_image and comp_image_pic from comp_images table
  let compImage = "";
  let compImagePic = "";
  const { data: compData, error: compError } = await supabase
    .from("comp_images")
    .select("comp_image, comp_image_pic")
    .eq("num_string", numString)
    .maybeSingle();
  if (!compError && compData) {
    if (compData.comp_image) compImage = compData.comp_image;
    if (compData.comp_image_pic) compImagePic = compData.comp_image_pic;
  }

  return {
    ...numData,
    comp_image: compImage,
    comp_image_pic: compImagePic,
  };
}

export async function upsertNumLoc({
  num_string,
  location,
  person,
  comp_image,
  comp_image_pic,
  location_view,
}) {
  // Upsert numberstrings row
  const { data, error } = await supabase
    .from("numberstrings")
    .upsert([{ num_string, location, person, location_view }], {
      onConflict: ["num_string"],
    })
    .select()
    .maybeSingle();
  if (error) throw error;

  // Upsert comp_images row (comp_image and comp_image_pic)
  const { error: compError } = await supabase
    .from("comp_images")
    .upsert([{ num_string, comp_image, comp_image_pic }], {
      onConflict: ["num_string"],
    });
  if (compError) throw compError;

  return data;
}
