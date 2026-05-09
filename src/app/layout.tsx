import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { C, FONT_SANS } from "@/lib/peterna-tokens";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Peterna — a beautiful tribute for the pet you loved",
  description:
    "Peterna turns your photos and memories into a cinematic tribute film, a permanent memorial page, and a family channel for every pet you've ever loved.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body
        className="antialiased"
        style={{
          background: C.cream,
          color: C.ink,
          minHeight: "100vh",
          fontFamily: FONT_SANS,
        }}
      >
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
