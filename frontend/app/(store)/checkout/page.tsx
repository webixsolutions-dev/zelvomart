import type { Metadata } from "next";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { PageIntro } from "@store/components/home/Blocks";
import { CheckoutView } from "@store/components/pages/CheckoutView";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function Page() {
  return (
    <div className="checkout-page">
      <Breadcrumbs items={[{ label: "Cart", href: "/cart/" }, { label: "Checkout" }]} />
      <PageIntro eyebrow="Secure checkout" title="Checkout" sub="Two quick steps. No account needed, no advance payment." />
      <CheckoutView />
    </div>
  );
}
