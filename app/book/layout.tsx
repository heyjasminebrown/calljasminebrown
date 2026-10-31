import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/brand/identity";

// Public booking pages (unauthenticated, linked from texts/emails). The
// original app wrapped these in its own marketing-site chrome (a shared
// nav/footer meant for a completely different, business-specific public
// site) - intentionally dropped here. Add your own public-facing
// header/footer component here if you want one.
export const metadata: Metadata = {
  manifest: null,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#ebeaeb",
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#ebeaeb]">{children}</div>;
}
