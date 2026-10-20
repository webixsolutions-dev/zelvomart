import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "@store/styles/globals.css";
import { site } from "@store/lib/site";
import { ShopProvider } from "@store/lib/store";
import { AnnouncementBar } from "@store/components/layout/AnnouncementBar";
import { Header } from "@store/components/layout/Header";
import { Footer } from "@store/components/layout/Footer";
import { CartDrawer } from "@store/components/layout/CartDrawer";
import { MobileBottomNav } from "@store/components/layout/MobileBottomNav";
import { Toaster } from "@store/components/layout/Toaster";
// Platform providers (non-visual): settings bootstrap, Meta/TikTok pixels, GA4, tracking events and session replays.
import { Suspense } from "react";
import { getStoreBootstrap } from "@/lib/store";
import TrackingProvider from "@/components/TrackingProvider";
import SessionReplayProvider from "@/components/SessionReplayProvider";
import MetaPixelScript from "@/components/MetaPixelScript";
import TikTokPixelScript from "@/components/TikTokPixelScript";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { loadStore, slimProduct } from "@store/lib/backend";
import { CatalogBridge } from "@store/lib/bridge";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-brand",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Zelvomart — Online Shopping in Pakistan | Cash on Delivery",
    template: "%s | Zelvomart",
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: site.locale,
    title: "Zelvomart — Everyday things, chosen better.",
    description: site.description,
    images: [{ url: "/brand/og-home.jpg", width: 1200, height: 630, alt: "Zelvomart: everyday things, chosen better" }],
  },
  twitter: { card: "summary_large_image" },
  // No site-wide canonical: each indexable page sets its own, so a page that forgets one never points at the home page.
  icons: {
    icon: [{ url: "/Fav-icon%20zelvomart.png", type: "image/png" }],
    shortcut: "/Fav-icon%20zelvomart.png",
    apple: "/Fav-icon%20zelvomart.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#009FE3",
  width: "device-width",
  initialScale: 1,
};

// Built per request, so it carries the phone and email from Admin → Settings.
const orgJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  "@id": `${site.url}/#organization`,
  name: site.name,
  alternateName: ["Zelvo Mart", "Zelvomart Pakistan"],
  url: `${site.url}/`,
  logo: `${site.url}/Zelvomart%20logo.png`,
  email: site.email,
  telephone: site.phoneDisplay,
  address: { "@type": "PostalAddress", addressLocality: "Lahore", addressRegion: "Punjab", addressCountry: "PK" },
  foundingDate: site.foundingDate,
  founder: { "@type": "Person", name: site.founder },
  sameAs: Object.values(site.social),
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: site.phoneDisplay,
    email: site.email,
    url: `https://wa.me/${site.whatsappNumber}`,
    areaServed: "PK",
    availableLanguage: ["en", "ur"],
  },
  currenciesAccepted: "PKR",
  paymentAccepted: "Cash",
});

export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [bootstrap, store] = await Promise.all([getStoreBootstrap().catch(() => null), loadStore()]);
  const settings = (bootstrap?.settings || {}) as Record<string, unknown>;
  const enabled = (key: string) => settings[key] !== false && settings[key] !== "false";
  const pixelId = String(settings["tracking.metaPixelId"] || "");
  const tiktokPixelId = String(settings["tracking.tiktokPixelId"] || "");
  return (
    <html lang="en-PK" className={manrope.variable}>
      <body>
        <CatalogBridge products={store.catalog.map(slimProduct)} settings={store.settings}>
        <ShopProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <AnnouncementBar />
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <MobileBottomNav />
          <CartDrawer />
          <Toaster />
        </ShopProvider>
        </CatalogBridge>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd()) }} />
        <Suspense fallback={null}>
          <TrackingProvider />
          <GoogleAnalytics />
          {enabled("tracking.sessionReplayEnabled") ? <SessionReplayProvider /> : null}
        </Suspense>
        {enabled("tracking.metaPixelEnabled") ? <MetaPixelScript pixelId={pixelId} /> : null}
        {enabled("tracking.tiktokPixelEnabled") ? <TikTokPixelScript pixelId={tiktokPixelId} /> : null}
      </body>
    </html>
  );
}
