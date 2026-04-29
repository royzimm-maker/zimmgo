import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZimmGo — AI Travel Planner",
  description:
    "Plan your perfect trip with an AI travel advisor. Gamified step-by-step flow from destination to day-by-day itinerary.",
  openGraph: {
    title: "ZimmGo — AI Travel Planner",
    description: "Your personal AI travel advisor.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
