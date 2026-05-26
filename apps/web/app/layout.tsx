import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Korepush",
  description: "Self-hosted K3s PaaS dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
