import styles from "./years.module.css";
import CityNameEditor from "../../../components/CityNameEditor";
import Link from "next/link";

export default function YearPage({ params }) {
  const { year } = params;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className={styles.container}>
      <Link href="/calendar-locations" className={styles.backLink}>
        ← Back to Calendar Locations
      </Link>
      <h2 className={styles.title}>Year: {year}</h2>
      <CityNameEditor year={year} />
      <ul className={styles.monthList}>
        {months.map((month) => (
          <li key={month} className={styles.monthItem}>
            {month}
          </li>
        ))}
      </ul>
    </div>
  );
}
