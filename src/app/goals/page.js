"use client";
import styles from "./Goals.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullseye } from "@fortawesome/free-solid-svg-icons";

export default function GoalsPage() {
  return (
    <div className={styles.goalsPage}>
      <header className={styles.goalsHeader}>
        <FontAwesomeIcon icon={faBullseye} /> Goals
      </header>
      <div className={styles.goalsCardParent}>
        {/* Add your goals content/cards here */}
        <div className={styles.goalsCard}>
          <p>Set and track your personal goals here.</p>
        </div>
      </div>
    </div>
  );
}
