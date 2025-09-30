"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../utils/supabaseClient";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  //   const handleSignUp = async () => {
  //     const { error } = await supabase.auth.signUp({ email, password });
  //     setMessage(
  //       error ? error.message : "Check your email for confirmation link!"
  //     );
  //   };

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleSignIn}>Log in</button>
      {/* <button onClick={handleSignUp}>Sign up</button> */}
      <div>{message}</div>
    </div>
  );
}
