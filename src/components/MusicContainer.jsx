import styles from "./MusicContainer.module.css";
import Link from "next/link";

export default function MusicContainer() {
  return (
    <div className={styles.musicContainer + " pageContainer"}>
      <h1>Music Dashboard</h1>

      <div className={styles.navigationSection}>
        <Link href="/music/charts" className={styles.chartLink}>
          <div className={styles.card}>
            <h2>📊 Charts</h2>
            <p>View and learn UK chart number 1s</p>
          </div>
        </Link>
      </div>

      {/* <MusicGenres />
      <MusicTracks /> */}
    </div>
  );
}
