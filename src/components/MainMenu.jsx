"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import supabase from "../utils/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";

export default function MainMenu() {
  const [user, setUser] = useState(null);

  //   useEffect(() => {
  //     const session = supabase.auth.getSession();
  //     setUser(session.user);
  //   }, []);

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );
    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <header>
      <Link href="/dashboard">
        <h1>My Dashboard</h1>
      </Link>
      <nav>
        <ul>
          {!user ? (
            <li>
              <Link href="/login">Login / sign up</Link>
            </li>
          ) : (
            <li>
              <Link href="/profile">
                <FontAwesomeIcon icon={faUser} /> {user.email}
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
