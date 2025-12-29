import supabase from "./supabaseClient.mjs";

// Fetch year_id (UUID) from year number
export async function fetchYearIdFromYear(year) {
  try {
    const { data, error } = await supabase
      .from("calendar_years")
      .select("id")
      .eq("year", year)
      .single();
    if (error) {
      console.error("Error fetching year_id from year:", error);
      return null;
    }
    return data?.id || null;
  } catch (error) {
    console.error("Error fetching year_id from year:", error);
    return null;
  }
}
// Fetch all month locations for a given year

export async function fetchYearMonthLocations(year_id) {
  try {
    const { data, error } = await supabase
      .from("calendar_year_months")
      .select("year_id, month_number, location_view, description")
      .eq("year_id", year_id)
      .order("month_number");
    if (error) {
      console.error("Error fetching year/month locations:", error);
      return [];
    }
    return data;
  } catch (error) {
    console.error("Error fetching year/month locations:", error);
    return [];
  }
}

// Upsert a month location for a given year
export async function upsertYearMonthLocation({
  year_id,
  month_number,
  location_view,
  description,
}) {
  try {
    const { data, error } = await supabase
      .from("calendar_year_months")
      .upsert(
        { year_id, month_number, location_view, description },
        { onConflict: ["year_id", "month_number"] }
      );
    if (error) {
      console.error("Error upserting year/month location:", error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error("Error upserting year/month location:", error);
    throw error;
  }
}

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

// Upsert a month colour, location_view, and description
export async function upsertMonthColour(monthData) {
  try {
    // Accepts: { month_number, colour_name, colour_hex, location_view, description }
    const { data, error } = await supabase
      .from("calendar_months")
      .upsert(monthData, {
        onConflict: "month_number",
        returning: "minimal",
      });

    if (error) {
      console.error("Error upserting month colour/location:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error upserting month colour/location:", error);
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
