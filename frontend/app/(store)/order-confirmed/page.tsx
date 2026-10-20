import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderConfirmed } from "@store/components/pages/OrderConfirmed";

export const metadata: Metadata = { title: "Order Confirmed", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="container skeleton-block" />}>
      <OrderConfirmed />
    </Suspense>
  );
}
