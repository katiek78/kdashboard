import styles from "./ChartsView.module.css";

export default function ChartsView() {
  return (
    <div className={styles.chartsContainer}>
      <h1>Charts</h1>

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
