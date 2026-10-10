"use client";

import { Fragment, Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CartProvider } from "@/components/CartProvider";
import PageMotion from "@/components/PageMotion";
import RouteTransitionOverlay from "@/components/RouteTransitionOverlay";

export default function SiteChrome({
  children,
  header,
  footer,
  cartDrawer,
  whatsapp,
  tracking,
  metaPixel,
  clarity,
  organizationJson,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  cartDrawer: ReactNode;
  whatsapp: ReactNode;
  tracking: ReactNode;
  metaPixel: ReactNode;
  clarity: ReactNode;
  organizationJson: string;
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
        <Fragment key="clarity">{clarity}</Fragment>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJson }} />
        <CartProvider>
          <Suspense fallback={null}><RouteTransitionOverlay /></Suspense>
          <main className="public-site-main">{children}</main>
          <Fragment key="tracking">{tracking}</Fragment>
        </CartProvider>
      </>
    );
  }

  return (
    <>
      <Fragment key="meta-pixel">{metaPixel}</Fragment>
      <Fragment key="clarity">{clarity}</Fragment>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJson }}
      />
      <CartProvider>
        <Suspense fallback={null}><RouteTransitionOverlay /></Suspense>
        <Fragment key="header">{header}</Fragment>
        <main className="public-site-main">{children}</main>
        <PageMotion />
        <Fragment key="footer">{footer}</Fragment>
        <Fragment key="cart">{cartDrawer}</Fragment>
        <Fragment key="whatsapp">{whatsapp}</Fragment>
        <Fragment key="tracking">{tracking}</Fragment>
      </CartProvider>
    </>
  );
}
