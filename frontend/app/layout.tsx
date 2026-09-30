import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { getCategories } from "@/lib/store";
import { getSetting } from "@/lib/settings";
import CartDrawer from "@/components/CartDrawer";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import TrackingProvider from "@/components/TrackingProvider";
import MetaPixelScript from "@/components/MetaPixelScript";
import ClarityScript from "@/components/ClarityScript";
import SiteChrome from "@/components/SiteChrome";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com"),
  title: { default: "Zelvomart | Online Shopping in Pakistan", template: "%s | Zelvomart" },
  description: "Shop quality-checked products with Cash on Delivery across Pakistan.",
  openGraph: { type: "website", siteName: "Zelvomart" },
};

export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, announcement, info, pixelId, clarityId] = await Promise.all([
    getCategories(),
    getSetting<any>("store.announcement", { enabled: true, items: [] }),
    getSetting<any>("store.info", { phone: "0300-2026711", email: "zelvomart@gmail.com", whatsapp: "923002026711" }),
    getSetting<string>("tracking.metaPixelId", process.env.NEXT_PUBLIC_META_PIXEL_ID || "1645715973642563"),
    getSetting<string>("tracking.clarityId", process.env.NEXT_PUBLIC_CLARITY_ID || ""),
  ]);

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
    <html lang="en">
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
