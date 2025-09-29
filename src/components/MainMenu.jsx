"use client";
import Link from "next/link";

export default function MainMenu() {
  return (
    <header>
      <h1>My Dashboard</h1>
      <nav>
        <ul>
          <li>
            <Link href="/login">Login</Link>
          </li>
          <li>
            <Link href="/register">Register</Link>
          </li>
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
