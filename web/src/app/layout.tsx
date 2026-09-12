import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steam Family Notifier — Setup & Dashboard",
  description: "Visual setup wizard and control center for Steam Family Sharing game tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-bg-glow" />
        {children}
      </body>
    </html>
  );
}
