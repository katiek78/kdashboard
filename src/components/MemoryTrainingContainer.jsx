import styles from "./MemoryTrainingContainer.module.css";
import FourDigitGrid from "./FourDigitGrid";

export default function GeoGuessrContainer() {
  return (
    <div className={styles.memoryContainer + " pageContainer"}>
      <h1>Image systems</h1>
      <h2>4-digit Ben System</h2>
      <FourDigitGrid />
    </div>
  );
}
