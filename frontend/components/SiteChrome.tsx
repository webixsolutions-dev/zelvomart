"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CartProvider } from "@/components/CartProvider";
import PageMotion from "@/components/PageMotion";

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

  return (
    <>
      {metaPixel}
      {clarity}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJson }}
      />
      <CartProvider>
        {header}
        <main className="public-site-main">{children}</main>
        <PageMotion />
        {footer}
        {cartDrawer}
        {whatsapp}
        {tracking}
      </CartProvider>
    </>
  );
}
