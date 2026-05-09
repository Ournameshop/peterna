import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "peterna.com — Coming Soon",
  description: "Something new is on the way.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
