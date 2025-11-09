import React from "react";
import styles from "./MemoryTrainingContainer.module.css";
import Link from "next/link";

export default function MemoryTrainingContainer() {
  const trainingTools = [
    {
      title: "3-Digit System",
      description: "Manage and train with the Ben System for 3-digit numbers",
      path: "/memory-training/three-digit-system",
      icon: "🔢",
    },
    {
      title: "4-Digit System",
      description: "Manage and train with the Ben System for 4-digit numbers",
      path: "/memory-training/four-digit-system",
      icon: "🔢",
    },
    {
      title: "Pi Training",
      description: "Practise memorising digits of Pi",
      path: "/pi",
      icon: "π",
    },
    {
      title: "Cards Training",
      description: "Practise memorising shuffled card decks",
      path: "/memory-training/cards",
      icon: "🃏",
    },
    {
      title: "Names Training",
      description: "Practise memorising names and faces",
      path: "/memory-training/names-faces",
      icon: "👥",
    },
    {
      title: "Words Training",
      description: "Memorise random word lists",
      path: "/memory-training/words",
      icon: "📝",
    },
    {
      title: "Numbers Training",
      description: "Practise with random number sequences",
      path: "/memory-training/numbers",
      icon: "🔢",
    },
  ];

  return (
    <div className={styles.memoryContainer + " pageContainer"}>
      <h1>Memory Training Tools</h1>
      <p style={{ fontSize: "18px", color: "#666", marginBottom: "32px" }}>
        Choose a training tool to improve your memory skills
      </p>

      <div className={styles.toolsGrid}>
        {trainingTools.map((tool, index) => (
          <Link key={index} href={tool.path} className={styles.toolCard}>
            <div className={styles.toolIcon}>{tool.icon}</div>
            <h3 className={styles.toolTitle}>{tool.title}</h3>
            <p className={styles.toolDescription}>{tool.description}</p>
          </Link>
        ))}
      </div>

      <div className={styles.comingSoon}>
        <h3>Coming Soon</h3>
        <ul>
          <li>Speed training modes</li>
          <li>Competition simulation</li>
          <li>Progress tracking and analytics</li>
          <li>Custom image systems</li>
        </ul>
      </div>
    </div>
  );
}
