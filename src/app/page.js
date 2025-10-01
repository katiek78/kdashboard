"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../utils/supabaseClient";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const loading = useAuthRedirect();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>Welcome to my dashboard!</main>
    </div>
  );
}
