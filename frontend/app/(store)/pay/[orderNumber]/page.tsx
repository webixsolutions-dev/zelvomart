import type { Metadata } from "next";
import { Suspense } from "react";
import { PayView } from "@store/components/pages/PayView";

// A private payment link: never indexed, never cached.
export const metadata: Metadata = { title: "Complete your payment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return (
    <Suspense fallback={<div className="container skeleton-block" />}>
      <PayView orderNumber={decodeURIComponent(orderNumber).toUpperCase()} />
    </Suspense>
  );
}
