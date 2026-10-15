import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import "./home-sections.css";
import "@/styles/admin-redesign.css";
import "@rrweb/replay/dist/style.css";
import { getMenuProducts, getStoreBootstrap } from "@/lib/store";
import CartDrawer from "@/components/CartDrawer";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import TrackingProvider from "@/components/TrackingProvider";
import SessionReplayProvider from "@/components/SessionReplayProvider";
import MetaPixelScript from "@/components/MetaPixelScript";
import TikTokPixelScript from "@/components/TikTokPixelScript";
import ClarityScript from "@/components/ClarityScript";
import ExperimentProvider from "@/components/ExperimentProvider";
import SiteChrome from "@/components/SiteChrome";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com"),
  title: { default: "Zelvomart | Online Shopping in Pakistan", template: "%s | Zelvomart" },
  description: "Shop quality-checked products with Cash on Delivery across Pakistan.",
  openGraph: { type: "website", siteName: "Zelvomart" },
  icons: { icon: "/images/zelvomart-logo.png" },
};

export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [bootstrap, menuProducts] = await Promise.all([
    getStoreBootstrap().catch(() => null),
    getMenuProducts().catch(() => []),
  ]);
  const categories = bootstrap?.categories || [];
  const announcement = (bootstrap?.settings?.["store.announcement"] || { enabled: true, items: [] }) as any;
  const info = (bootstrap?.settings?.["store.info"] || { phone: "0300-2026711", email: "zelvomart@gmail.com", whatsapp: "923002026711" }) as any;
  const pixelId = String(bootstrap?.settings?.["tracking.metaPixelId"] || process.env.NEXT_PUBLIC_META_PIXEL_ID || "1645715973642563");
  const tiktokPixelId = String(bootstrap?.settings?.["tracking.tiktokPixelId"] || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "");
  const clarityId = String(bootstrap?.settings?.["tracking.clarityId"] || process.env.NEXT_PUBLIC_CLARITY_ID || "");

  const metaPixelEnabled = bootstrap?.settings?.["tracking.metaPixelEnabled"] !== false && bootstrap?.settings?.["tracking.metaPixelEnabled"] !== "false";
  const tiktokPixelEnabled = bootstrap?.settings?.["tracking.tiktokPixelEnabled"] !== false && bootstrap?.settings?.["tracking.tiktokPixelEnabled"] !== "false";
  const clarityEnabled = bootstrap?.settings?.["tracking.clarityEnabled"] !== false && bootstrap?.settings?.["tracking.clarityEnabled"] !== "false";
  const sessionReplayEnabled = bootstrap?.settings?.["tracking.sessionReplayEnabled"] !== false && bootstrap?.settings?.["tracking.sessionReplayEnabled"] !== "false";

  const phoneDisplay = String(info.phone || "0300-2026711").startsWith("+")
    ? info.phone
    : `+92 ${String(info.phone || "0300-2026711").replace(/^0/, "").replace(/(\d{3})(\d{7})/, "$1 $2")}`;

  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zelvomart",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: info.phone,
      contactType: "customer service",
      areaServed: "PK",
    },
  };

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" type="image/webp" href="/images/hero/zelvomart-slider-01.webp" />
      </head>
      <body className={manrope.variable}>
        {/* The Turbopack performance.measure fix runs from instrumentation-client.ts (no <script> tag). */}
        <SiteChrome
          header={
            <Suspense fallback={null}>
            <Header
              categories={categories}
                products={menuProducts}
              announcementItems={announcement.enabled ? announcement.items : []}
              phone={phoneDisplay}
              whatsapp={String(info.whatsapp || "923002026711")}
            />
            </Suspense>
          }
          footer={<Footer categories={categories} phone={phoneDisplay} email={info.email} />}
          cartDrawer={<CartDrawer />}
          whatsapp={<FloatingWhatsApp number={String(info.whatsapp || "923002026711")} />}
          tracking={
            <Suspense fallback={null}>
              <TrackingProvider />
              {sessionReplayEnabled ? <SessionReplayProvider /> : null}
              <ExperimentProvider />
            </Suspense>
          }
          metaPixel={metaPixelEnabled ? <MetaPixelScript pixelId={pixelId} /> : null}
          tiktokPixel={tiktokPixelEnabled ? <TikTokPixelScript pixelId={tiktokPixelId} /> : null}
          clarity={clarityEnabled ? <ClarityScript projectId={clarityId} /> : null}
          organizationJson={JSON.stringify(org)}
          delivery={(bootstrap?.settings?.["store.delivery"] || null) as any}
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}