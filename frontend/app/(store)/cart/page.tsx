import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CartView } from "@/components/pages/CartView";

export const metadata: Metadata = { title: "Your Cart", robots: { index: false } };

export default function Page() {
  return (
    <div className="cart-page">
      <Breadcrumbs items={[{ label: "Cart" }]} />
      {/* The “Your Cart” heading lives in CartView so it can be hidden while the cart is empty. */}
      <CartView />
    </div>
  );
}
