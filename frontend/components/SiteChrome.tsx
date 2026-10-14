"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CartProvider } from "@/components/CartProvider";
import { DeliveryPolicyProvider } from "@/components/DeliveryPolicy";
import type { DeliverySettings } from "@/lib/shipping";
import PageMotion from "@/components/PageMotion";

export default function SiteChrome({
  children,
  header,
  footer,
  cartDrawer,
  whatsapp,
  tracking,
  metaPixel,
  tiktokPixel,
  clarity,
  organizationJson,
  delivery,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  cartDrawer: ReactNode;
  whatsapp: ReactNode;
  tracking: ReactNode;
  metaPixel: ReactNode;
  tiktokPixel?: ReactNode;
  clarity: ReactNode;
  organizationJson: string;
  delivery?: DeliverySettings | null;
}) {
  const pathname = usePathname();
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (adminRoute) {
    return <>{children}</>;
  }

  const checkoutRoute = pathname === "/checkout";
  if (checkoutRoute) {
    return (
      <>
        <Fragment key="meta-pixel">{metaPixel}</Fragment>
        <Fragment key="tiktok-pixel">{tiktokPixel}</Fragment>
        <Fragment key="clarity">{clarity}</Fragment>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJson }} />
        <DeliveryPolicyProvider value={delivery}>
        <CartProvider>
          <main className="public-site-main">{children}</main>
          <Fragment key="tracking">{tracking}</Fragment>
        </CartProvider>
        </DeliveryPolicyProvider>
      </>
    );
  }

  return (
    <>
      <Fragment key="meta-pixel">{metaPixel}</Fragment>
      <Fragment key="tiktok-pixel">{tiktokPixel}</Fragment>
      <Fragment key="clarity">{clarity}</Fragment>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJson }}
      />
      <DeliveryPolicyProvider value={delivery}>
      <CartProvider>
        <Fragment key="header">{header}</Fragment>
        <main className="public-site-main">{children}</main>
        <PageMotion />
        <Fragment key="footer">{footer}</Fragment>
        <Fragment key="cart">{cartDrawer}</Fragment>
        <Fragment key="whatsapp">{whatsapp}</Fragment>
        <Fragment key="tracking">{tracking}</Fragment>
      </CartProvider>
      </DeliveryPolicyProvider>
    </>
  );
}
