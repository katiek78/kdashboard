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
  try {
    console.log("Upserting data:", {
      num_string,
      location,
      person,
      comp_image,
      comp_image_pic,
      location_view,
      category_image,
      four_digit_ben_tricky,
    });

    // Validate num_string
    if (!num_string || typeof num_string !== "string") {
      throw new Error("Invalid num_string provided");
    }

    // Sanitize string inputs to prevent potential issues
    const sanitizeString = (str) => {
      if (typeof str !== "string") return str;
      // Remove any null bytes or other problematic characters
      return str.replace(/\0/g, "").trim();
    };

    // Upsert numberstrings row
    const numberstringData = { num_string };
    if (location !== undefined)
      numberstringData.location = sanitizeString(location);
    if (person !== undefined) numberstringData.person = sanitizeString(person);
    if (location_view !== undefined)
      numberstringData.location_view = sanitizeString(location_view);
    if (four_digit_ben_tricky !== undefined)
      numberstringData.four_digit_ben_tricky = four_digit_ben_tricky;

    // Check if record exists
    const { data: existingNumberstring } = await supabase
      .from("numberstrings")
      .select("num_string")
      .eq("num_string", num_string)
      .maybeSingle();

    let data;
    if (existingNumberstring) {
      // Update existing record (exclude num_string from update data)
      const updateData = { ...numberstringData };
      delete updateData.num_string;

      console.log("Updating numberstrings with:", updateData);

      // Only perform update if there's actual data to update
      if (Object.keys(updateData).length > 0) {
        const { data: updateResult, error } = await supabase
          .from("numberstrings")
          .update(updateData)
          .eq("num_string", num_string)
          .select()
          .maybeSingle();
        if (error) {
          console.error("Numberstrings update error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          throw error;
        }
        data = updateResult;
      } else {
        console.log("No numberstrings data to update, skipping update");
        // Fetch existing data since we're not updating
        const { data: existingData } = await supabase
          .from("numberstrings")
          .select("*")
          .eq("num_string", num_string)
          .maybeSingle();
        data = existingData;
      }
    } else {
      // Insert new record
      console.log("Inserting numberstrings with:", numberstringData);
      const { data: insertResult, error } = await supabase
        .from("numberstrings")
        .insert([numberstringData])
        .select()
        .maybeSingle();
      if (error) {
        console.error("Numberstrings insert error:", error);
        throw error;
      }
      data = insertResult;
    }

    // Upsert comp_images row (comp_image and comp_image_pic)
    if (comp_image !== undefined || comp_image_pic !== undefined) {
      // Sanitize comp image data
      const sanitized_comp_image =
        comp_image !== undefined ? sanitizeString(comp_image) : undefined;
      const sanitized_comp_image_pic =
        comp_image_pic !== undefined
          ? sanitizeString(comp_image_pic)
          : undefined;
      // Check if record exists
      const { data: existingComp } = await supabase
        .from("comp_images")
        .select("num_string")
        .eq("num_string", num_string)
        .maybeSingle();

      if (existingComp) {
        // Update existing record
        const updateData = {};
        if (sanitized_comp_image !== undefined)
          updateData.comp_image = sanitized_comp_image;
        if (sanitized_comp_image_pic !== undefined)
          updateData.comp_image_pic = sanitized_comp_image_pic;

        console.log("Updating comp_images with:", updateData);
        const { error: compError } = await supabase
          .from("comp_images")
          .update(updateData)
          .eq("num_string", num_string);
        if (compError) {
          console.error("Comp_images update error:", compError);
          throw compError;
        }
      } else {
        // Insert new record
        const insertData = {
          num_string,
          comp_image: sanitized_comp_image || "",
          comp_image_pic: sanitized_comp_image_pic || "",
        };
        console.log("Inserting comp_images with:", insertData);
        const { error: compError } = await supabase
          .from("comp_images")
          .insert([insertData]);
        if (compError) {
          console.error("Comp_images insert error:", compError);
          throw compError;
        }
      }
    }

    // Upsert category_images row (category_image)
    if (category_image !== undefined) {
      const sanitized_category_image = sanitizeString(category_image);
      // Check if record exists
      const { data: existingCategory } = await supabase
        .from("category_images")
        .select("num_string")
        .eq("num_string", num_string)
        .maybeSingle();

      if (existingCategory) {
        // Update existing record
        console.log("Updating category_images with:", {
          category_image: sanitized_category_image,
        });
        const { error: categoryError } = await supabase
          .from("category_images")
          .update({ category_image: sanitized_category_image })
          .eq("num_string", num_string);
        if (categoryError) {
          console.error("Category_images update error:", categoryError);
          throw categoryError;
        }
      } else {
        // Insert new record
        const insertData = {
          num_string,
          category_image: sanitized_category_image,
        };
        console.log("Inserting category_images with:", insertData);
        const { error: categoryError } = await supabase
          .from("category_images")
          .insert([insertData]);
        if (categoryError) {
          console.error("Category_images insert error:", categoryError);
          throw categoryError;
        }
      }
    }

    console.log("Upsert completed successfully");
    return data;
  } catch (error) {
    console.error("Upsert operation failed:", error);
    throw error;
  }
}

export async function debugSpecificNumber(numString) {
  console.log(`DEBUG: Checking number ${numString}`);

  const { data: compData, error } = await supabase
    .from("comp_images")
    .select("*")
    .eq("num_string", numString)
    .maybeSingle();

  console.log(`DEBUG: comp_images result for ${numString}:`, compData, error);
  return compData;
}

export async function fetchRandomNumberWithoutCompImage(currentNumber) {
  try {
    // Determine the range based on current number
    const digitCount = currentNumber ? currentNumber.length : 4;
    let startNum, endNum;

    if (digitCount === 1) {
      startNum = 0;
      endNum = 9;
    } else if (digitCount === 2) {
      startNum = 0; // 2-digit: 00, 01, 02, ..., 99
      endNum = 99;
    } else if (digitCount === 3) {
      startNum = 0; // 3-digit: 000, 001, 002, ..., 999
      endNum = 999;
    } else {
      // For 4-digit numbers, find which thousand range based on first digit
      // e.g., 0199 -> 0000-0999, 1234 -> 1000-1999, 4334 -> 4000-4999
      const firstDigit = parseInt(currentNumber.charAt(0));
      startNum = firstDigit * 1000;
      endNum = startNum + 999;
    }

    // Format the range for logging with proper padding
    const startNumFormatted = startNum.toString().padStart(digitCount, "0");
    const endNumFormatted = endNum.toString().padStart(digitCount, "0");
    console.log(
      `Searching for gaps in range ${startNumFormatted} to ${endNumFormatted}`
    );

    // Generate all numbers in this range with proper padding
    const allNumbersInRange = [];
    for (let i = startNum; i <= endNum; i++) {
      const numString = i.toString().padStart(digitCount, "0");
      allNumbersInRange.push(numString);
    }

    // Fetch records for this specific range
    const { data: recordsInRange, error } = await supabase
      .from("comp_images")
      .select("num_string, comp_image")
      .in("num_string", allNumbersInRange);

    if (error) {
      console.error("Error fetching comp_images records:", error);
      // Provide more specific error message for network issues
      if (error.message && error.message.includes("Failed to fetch")) {
        throw new Error(
          "Network connection error - please check your internet connection and try again"
        );
      }
      throw error;
    }

    console.log(
      `Found ${
        recordsInRange?.length || 0
      } records in range ${startNum}-${endNum}`
    );

    // Find which numbers have comp_image values
    const numbersWithCompImage = new Set();
    recordsInRange?.forEach((record) => {
      if (record.comp_image && record.comp_image.trim() !== "") {
        numbersWithCompImage.add(record.num_string);
      }
    });

    // Find gaps - numbers that don't have comp_image
    const numbersWithoutCompImage = allNumbersInRange.filter(
      (numString) => !numbersWithCompImage.has(numString)
    );

    //    console.log(`Numbers WITH comp_image: ${numbersWithCompImage.size}`);
    console.log(
      `Numbers WITHOUT comp_image: ${numbersWithoutCompImage.length}`
    );

    if (numbersWithoutCompImage.length === 0) {
      console.log(
        `All numbers in range ${startNum}-${endNum} have comp_image assigned. Trying next digit level...`
      );

      // Try the next digit level
      if (digitCount < 4) {
        return await fetchRandomNumberWithoutCompImage(
          currentNumber.padStart(digitCount + 1, "0")
        );
      } else {
        // For 4-digit numbers, if no gaps in current thousand, try other thousands
        const firstDigit = parseInt(currentNumber.charAt(0));

        // Try the next thousand range (0->1, 1->2, etc.)
        if (firstDigit < 9) {
          const nextThousand = (firstDigit + 1).toString() + "000";
          console.log(
            `No gaps in ${startNum}-${endNum} range. Trying ${nextThousand.charAt(
              0
            )}000-${nextThousand.charAt(0)}999 range...`
          );
          return await fetchRandomNumberWithoutCompImage(nextThousand);
        } else {
          // If we've tried all thousands (0-9), then we're done
          throw new Error(
            "All numbers in all ranges have comp_image assigned! You've completed this section."
          );
        }
      }
    }

    // Pick a random number from those without comp_image
    const randomIndex = Math.floor(
      Math.random() * numbersWithoutCompImage.length
    );
    const selectedNumber = numbersWithoutCompImage[randomIndex];
    console.log("Selected random number without comp_image:", selectedNumber);

    return selectedNumber;
  } catch (error) {
    console.error("Error fetching random number without comp_image:", error);
    throw error;
  }
}
