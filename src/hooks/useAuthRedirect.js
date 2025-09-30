"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../utils/supabaseClient";

export function useAuthRedirect(redirectTo = "/login") {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session?.user) {
        router.replace(redirectTo);
      }
      setLoading(false);
    });
  }, [router, redirectTo]);

  return loading;
}
