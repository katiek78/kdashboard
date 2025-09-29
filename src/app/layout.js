"use client";
import "./globals.css";
import MainMenu from "../components/MainMenu";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MainMenu />
        {children}
      </body>
    </html>
  );
}
