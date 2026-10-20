import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import AppNotifications from "@/components/AppNotifications";
import "./admin-base.css";
import "@/styles/admin-redesign.css";
import "@/styles/admin-print-tables.css";
import "@rrweb/replay/dist/style.css";

// Same font variable the admin styles use today (--font-manrope).
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "Zelvomart Admin", template: "%s | Zelvomart Admin" },
  robots: { index: false, follow: false },
  icons: { icon: "/images/zelvomart-logo.png" },
};

/** Root layout for /admin: only the admin's own CSS loads here, never the storefront's. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={manrope.variable}>
        <AppNotifications />
        {children}
      </body>
    </html>
  );
}
