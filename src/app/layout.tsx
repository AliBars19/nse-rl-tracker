import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (Latin subset, OFL licensed) rather than next/font/google: Vercel's build
// servers were served Google Fonts URLs that Turbopack's Google loader could not resolve,
// and self-hosting also means builds never depend on fonts.googleapis.com.
const chakra = localFont({
  variable: "--font-chakra",
  display: "swap",
  src: [
    { path: "./fonts/ChakraPetch-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ChakraPetch-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ChakraPetch-700.woff2", weight: "700", style: "normal" },
  ],
});

const plexSans = localFont({
  variable: "--font-plex-sans",
  display: "swap",
  src: [
    { path: "./fonts/IBMPlexSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSans-600.woff2", weight: "600", style: "normal" },
  ],
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  display: "swap",
  src: [
    { path: "./fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-600.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: "City Esports · Rocket League Tracker", template: "%s · City RL Tracker" },
  description:
    "Standings, scouting, match nights and player stats for City, University of London's Rocket League teams in NSE.",
};

export const viewport: Viewport = {
  themeColor: "#080A0F",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${chakra.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
