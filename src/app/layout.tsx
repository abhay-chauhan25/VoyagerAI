import type { Metadata, Viewport } from "next";
import { Literata, Rokkitt } from "next/font/google";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

const rokkitt = Rokkitt({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-rokkitt",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Voyager — plan a trip that fits you", template: "%s · Voyager" },
  description:
    "Voyager turns the places you save into a day-by-day trip on a map, and lets your friends plan it with you.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dfdedb" },
    { media: "(prefers-color-scheme: dark)", color: "#12120f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${rokkitt.variable} ${literata.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
