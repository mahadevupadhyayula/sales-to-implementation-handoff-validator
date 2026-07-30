import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Implementation Intelligence",
  description: "Human-approved sales-to-implementation handoff review",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
