"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../utils/supabaseClient";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>Welcome to my dashboard!</main>
    </div>
  );
}
