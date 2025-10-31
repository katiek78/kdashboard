import supabase from "./supabaseClient";

// Fetch all month colors
export async function fetchMonthColours() {
  try {
    const { data, error } = await supabase
      .from("calendar_months")
      .select("*")
      .order("month_number");

    if (error) {
      console.error("Error fetching month colours:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching month colours:", error);
    return null;
  }
}

// Upsert a month colour
export async function upsertMonthColour(monthData) {
  try {
    const { data, error } = await supabase
      .from("calendar_months")
      .upsert(monthData, {
        onConflict: "month_number",
        returning: "minimal",
      });

    if (error) {
      console.error("Error upserting month colour:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error upserting month colour:", error);
    throw error;
  }
}

// Fetch all month days
export async function fetchMonthDays() {
  try {
    const { data, error } = await supabase
      .from("calendar_month_days")
      .select("*")
      .order("day_number");

    if (error) {
      console.error("Error fetching month days:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching month days:", error);
    return null;
  }
}

// Upsert a month day object
export async function upsertMonthDay(dayData) {
  try {
    const { data, error } = await supabase
      .from("calendar_month_days")
      .upsert(dayData, {
        onConflict: "day_number",
        returning: "minimal",
      });

    if (error) {
      console.error("Error upserting month day:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error upserting month day:", error);
    throw error;
  }
}
