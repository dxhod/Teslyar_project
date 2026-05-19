import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teslyar Amazon Dashboard",
  description: "Amazon EU portfolio dashboard for March vs April 2026"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
