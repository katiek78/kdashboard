import styles from "./ChartsView.module.css";
import Link from "next/link";

export default function ChartsView() {
  return (
    <div className={styles.chartsContainer}>
      <div className={styles.header}>
        <Link href="/music" className={styles.backLink}>
          ← Back to Music
        </Link>
        <h1>Charts</h1>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2>Chart list</h2>
          <div className={styles.chartContent}>
            <p>View the list of UK chart number 1s</p>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h2>Chart test</h2>
          <div className={styles.chartContent}>
            <p>Test yourself on UK chart number 1s</p>
          </div>
        </div>
      </div>
    </div>
  );
}
