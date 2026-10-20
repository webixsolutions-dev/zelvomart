import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { site } from "@store/lib/site";
import { ShopProvider } from "@store/lib/store";
import { AnnouncementBar } from "@store/components/layout/AnnouncementBar";
import { Header } from "@store/components/layout/Header";
import { Footer } from "@store/components/layout/Footer";
import { CartDrawer } from "@store/components/layout/CartDrawer";
import { MobileBottomNav } from "@store/components/layout/MobileBottomNav";
import { Toaster } from "@store/components/layout/Toaster";

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

const orgJsonLd = {
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PK" className={manrope.variable}>
      <body>
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </body>
    </html>
  );
}
