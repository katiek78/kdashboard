import { useEffect, useState } from "react";
import supabase from "../utils/supabaseClient";

export default function CalendarYearsWithCities({
  start = 2000,
  count = 100,
  currentYear,
}) {
  const [cityMap, setCityMap] = useState({});
  const years = [];
  for (let year = start; year < start + count; year++) years.push(year);

  useEffect(() => {
    supabase
      .from("calendar_years")
      .select("year, city_name")
      .in("year", years)
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(({ year, city_name }) => {
            if (city_name) map[year] = city_name;
          });
          setCityMap(map);
        }
      });
    // eslint-disable-next-line
  }, []);

  return { cityMap };
}
