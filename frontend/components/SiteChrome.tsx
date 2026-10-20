"use client";

import { Fragment, type ReactNode } from "react";
import StoreSettingsSync from './StoreSettingsSync';
import { usePathname } from "next/navigation";
import { CartProvider } from "@/components/CartProvider";
import { DeliveryPolicyProvider } from "@/components/DeliveryPolicy";
import type { DeliverySettings } from "@/lib/shipping";
import {LaunchCatalogProvider} from '@/lib/launch/store';
import {Header as LaunchHeader} from '@/components/launch/layout/Header';
import {Footer as LaunchFooter} from '@/components/launch/layout/Footer';
import {AnnouncementBar} from '@/components/launch/layout/AnnouncementBar';
import {MobileBottomNav} from '@/components/launch/layout/MobileBottomNav';
import type {Category as LaunchCategory,Product as LaunchProduct} from '@/lib/launch/catalog';

export default function SiteChrome({
  children,
  cartDrawer,
  whatsapp,
  tracking,
  metaPixel,
  tiktokPixel,
  organizationJson,
  delivery,
  launchCatalog,
}: {
  children: ReactNode;
  cartDrawer: ReactNode;
  whatsapp: ReactNode;
  tracking: ReactNode;
  metaPixel: ReactNode;
  tiktokPixel?: ReactNode;
  organizationJson: string;
  delivery?: DeliverySettings | null;
  launchCatalog?: {categories:LaunchCategory[];products:LaunchProduct[];info?:{phone?:string;email?:string;whatsapp?:string;replayRetentionDays?:number}};
}) {
  const pathname = usePathname().replace(/\/+$/,'') || '/';
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (adminRoute) {
    return <>{children}</>;
  }

  const checkoutRoute = pathname === "/checkout";
  const designRoute=pathname==='/'||['/shop-all-products','/new-arrivals','/bestsellers','/deals-and-offers','/category/','/search','/contact-us','/about-us','/faqs','/shipping-policy','/refund-and-return-policy','/terms-and-conditions','/privacy-policy','/wishlist','/track-order','/track-your-order'].some(p=>pathname.startsWith(p));
  if (checkoutRoute) {
    return (
      <div className="launch-storefront">
        <StoreSettingsSync/>
        <Fragment key="meta-pixel">{metaPixel}</Fragment>
        <Fragment key="tiktok-pixel">{tiktokPixel}</Fragment>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJson }} />
        <DeliveryPolicyProvider value={delivery}>
        <CartProvider>
          <main className="public-site-main"><div className={designRoute?undefined:"launch-legacy"}>{children}</div></main>
          <Fragment key="tracking">{tracking}</Fragment>
        </CartProvider>
        </DeliveryPolicyProvider>
      </div>
    );
  }

  return (
    <div className="launch-storefront">
      <StoreSettingsSync/>
      <Fragment key="meta-pixel">{metaPixel}</Fragment>
      <Fragment key="tiktok-pixel">{tiktokPixel}</Fragment>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJson }}
      />
      <DeliveryPolicyProvider value={delivery}>
      <CartProvider>
      <LaunchCatalogProvider categories={launchCatalog?.categories||[]} products={launchCatalog?.products||[]} info={launchCatalog?.info}>
        <AnnouncementBar/>
        <LaunchHeader/>
        <main className="public-site-main"><div className={designRoute?undefined:"launch-legacy"}>{children}</div></main>
        <LaunchFooter/>
        <MobileBottomNav/>
        <div className="launch-legacy">{cartDrawer}</div>
        <Fragment key="whatsapp">{whatsapp}</Fragment>
        <Fragment key="tracking">{tracking}</Fragment>
      </LaunchCatalogProvider>
      </CartProvider>
      </DeliveryPolicyProvider>
    </div>
  );
}
