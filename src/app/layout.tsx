import type { Metadata, Viewport } from "next";
import { B612_Mono, Bodoni_Moda, Literata } from "next/font/google";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["500", "700"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const b612 = B612_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-b612",
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
    { media: "(prefers-color-scheme: light)", color: "#f0e8da" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1326" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${literata.variable} ${b612.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
