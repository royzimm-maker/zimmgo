import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Trying Poppins as the site-wide font to pair with the new ZimmGo branding —
// geometric-sans shape close to the logo's Avenir Next wordmark, and free to
// self-host unlike Avenir Next itself.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
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
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
