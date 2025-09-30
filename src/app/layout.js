import "./globals.css";
import MainMenu from "../components/MainMenu";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MainMenu />
        {children}
      </body>
    </html>
  );
}
