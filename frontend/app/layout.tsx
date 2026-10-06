import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import "@rrweb/replay/dist/style.css";
import { getStoreBootstrap } from "@/lib/store";
import CartDrawer from "@/components/CartDrawer";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import TrackingProvider from "@/components/TrackingProvider";
import SessionReplayProvider from "@/components/SessionReplayProvider";
import MetaPixelScript from "@/components/MetaPixelScript";
import ClarityScript from "@/components/ClarityScript";
import ExperimentProvider from "@/components/ExperimentProvider";
import SiteChrome from "@/components/SiteChrome";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com"),
  title: { default: "Zelvomart | Online Shopping in Pakistan", template: "%s | Zelvomart" },
  description: "Shop quality-checked products with Cash on Delivery across Pakistan.",
  openGraph: { type: "website", siteName: "Zelvomart" },
  icons: { icon: "/images/zelvomart-logo.png" },
};

export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const bootstrap = await getStoreBootstrap();
  const categories = bootstrap.categories;
  const announcement = (bootstrap.settings["store.announcement"] || { enabled: true, items: [] }) as any;
  const info = (bootstrap.settings["store.info"] || { phone: "0300-2026711", email: "zelvomart@gmail.com", whatsapp: "923002026711" }) as any;
  const pixelId = String(bootstrap.settings["tracking.metaPixelId"] || process.env.NEXT_PUBLIC_META_PIXEL_ID || "1645715973642563");
  const clarityId = String(bootstrap.settings["tracking.clarityId"] || process.env.NEXT_PUBLIC_CLARITY_ID || "");

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
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preload" as="image" type="image/webp" href="/images/hero/zelvomart-slider-01.webp" />
      </head>
      <body>
        <SiteChrome
          header={
            <Header
              categories={categories}
              announcementItems={announcement.enabled ? announcement.items : []}
              phone={phoneDisplay}
            />
          }
          footer={<Footer categories={categories} phone={phoneDisplay} email={info.email} />}
          cartDrawer={<CartDrawer />}
          whatsapp={<FloatingWhatsApp number={String(info.whatsapp || "923002026711")} />}
          tracking={
            <Suspense fallback={null}>
              <TrackingProvider />
              <SessionReplayProvider />
              <ExperimentProvider />
            </Suspense>
          }
          metaPixel={<MetaPixelScript pixelId={pixelId} />}
          clarity={<ClarityScript projectId={clarityId} />}
          organizationJson={JSON.stringify(org)}
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
