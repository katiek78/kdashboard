"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import styles from "../FocusPage.module.css";
import { fetchTaskById } from "../../../utils/taskUtils";

const backgrounds = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1500&q=80", // lake with mountains
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1500&q=80", // hills
  "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1500&q=80", //NYC
  "https://images.unsplash.com/photo-1520052205864-92d242b3a76b?auto=format&fit=crop&w=1500&q=80", //pink cityscape
  "https://images.unsplash.com/photo-1715847852455-066d71ab3be9?auto=format&fit=crop&w=1500&q=80", //Shinjuku
  "https://images.unsplash.com/photo-1593755673003-8ca8dbf906c2?auto=format&fit=crop&w=1500&q=80", //Queenstown
  "https://plus.unsplash.com/premium_photo-1691675471605-e52d9151406d?auto=format&fit=crop&w=1500&q=80", //Maldives
];

export default function FocusPage() {
  const params = useParams();
  const { taskId } = params;
  const [taskName, setTaskName] = useState("");
  const [loading, setLoading] = useState(true);
  const [bgUrl, setBgUrl] = useState(backgrounds[0]);
  const loadingAuth = useAuthRedirect();

  useEffect(() => {
    setBgUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);
  }, []);

  useEffect(() => {
    async function getTask() {
      try {
        const name = await fetchTaskById(taskId);
        setTaskName(name);
      } catch (err) {
        setTaskName("Unknown Task");
      } finally {
        setLoading(false);
      }
    }
    getTask();
  }, [taskId]);

  if (loadingAuth) {
    return <div>Loading...</div>;
  }

  const goToQuickTaskList = () => {
    window.location.href = "/tasks";
  };

  return (
    <div
      className={styles.background}
      style={{ backgroundImage: `url('${bgUrl}')` }}
    >
      <div className={styles.centeredBox}>
        {loading ? (
          <h1 className={styles.taskName}>Loading...</h1>
        ) : (
          <h1 className={styles.taskName} onClick={goToQuickTaskList}>
            {taskName}
          </h1>
        )}
        {/* Timer will go here later */}
      </div>
    </div>
  );
}
