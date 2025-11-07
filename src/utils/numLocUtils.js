import supabase from "./supabaseClient";

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

  // Fetch category_image from category_images table
  let categoryImage = "";
  const { data: categoryData, error: categoryError } = await supabase
    .from("category_images")
    .select("category_image")
    .eq("num_string", numString)
    .maybeSingle();
  if (!categoryError && categoryData) {
    if (categoryData.category_image)
      categoryImage = categoryData.category_image;
  }

  // Fetch four_digit_ben_tricky flag from numberstrings table (already included in numData)
  const fourDigitBenTricky = numData?.four_digit_ben_tricky || false;

  return {
    ...numData,
    comp_image: compImage,
    comp_image_pic: compImagePic,
    category_image: categoryImage,
    four_digit_ben_tricky: fourDigitBenTricky,
  };
}

export async function upsertNumLoc({
  num_string,
  location,
  person,
  comp_image,
  comp_image_pic,
  location_view,
  category_image,
  four_digit_ben_tricky,
}) {
  // Upsert numberstrings row
  const numberstringData = { num_string, location, person, location_view };
  if (four_digit_ben_tricky !== undefined) {
    numberstringData.four_digit_ben_tricky = four_digit_ben_tricky;
  }

  const { data, error } = await supabase
    .from("numberstrings")
    .upsert([numberstringData], {
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

  // Upsert category_images row (category_image)
  if (category_image !== undefined) {
    const { error: categoryError } = await supabase
      .from("category_images")
      .upsert([{ num_string, category_image }], {
        onConflict: ["num_string"],
      });
    if (categoryError) throw categoryError;
  }

  return data;
}
