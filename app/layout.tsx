import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { APP_NAME, DEFAULT_APP_ORIGIN } from "@/lib/brand/identity";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves relative/route-based metadata (og:image from the /book and
  // /book/[slug] opengraph-image.tsx files) to the real domain rather
  // than Next's localhost fallback - without this, a texted /book link's
  // preview card can resolve its image to the wrong host.
  metadataBase: new URL(process.env.APP_BASE_URL ?? DEFAULT_APP_ORIGIN),
  title: APP_NAME,
  description: "CRM for leads, follow-ups, and pipeline.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#34223a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
