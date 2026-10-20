import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/home/Blocks";
import { WishlistView } from "@/components/pages/WishlistView";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function Page() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Wishlist" }]} />
      <PageIntro eyebrow="Saved for later" title="Your Wishlist" sub="Keep track of the products you love." />
      <section className="section pt-sm">
        <div className="container">
          <WishlistView />
        </div>
      </section>
    </>
  );
}
