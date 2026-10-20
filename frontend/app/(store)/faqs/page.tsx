import type { Metadata } from "next";
import { allFaqs } from "@store/lib/content";
import { shareMeta } from "@store/lib/seo";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { PageIntro, WhatsAppBand } from "@store/components/home/Blocks";
import { FaqAccordion, FaqJsonLd } from "@store/components/ui/FaqAccordion";

export const metadata: Metadata = {
  title: { absolute: "Zelvomart FAQs: Delivery, Cash on Delivery & Returns" },
  description:
    "Answers to common questions about ordering from Zelvomart: Cash on Delivery, delivery times and charges, order tracking, returns and exchanges in Pakistan.",
  alternates: { canonical: "/faqs/" },
  ...shareMeta({
    title: "Zelvomart FAQs: Delivery, Cash on Delivery & Returns",
    description:
      "Answers to common questions about ordering from Zelvomart: Cash on Delivery, delivery times and charges, order tracking, returns and exchanges in Pakistan.",
    path: "/faqs/",
  }),
};

const groups = ["About Zelvomart", "Orders", "Delivery", "Payments", "Returns", "Products"] as const;

export default function Page() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Help" }, { label: "FAQs" }]} />
      <PageIntro
        eyebrow="Help centre"
        title={
          <>
            Frequently asked <span className="text-blue">questions</span>
          </>
        }
        sub="Clear answers about products, ordering, delivery and returns."
      />
      <section className="section pt-sm">
        <div className="container-narrow">
          {groups.map((g) => {
            const items = allFaqs.filter((f) => f.group === g);
            if (!items.length) return null;
            return (
              <div className="faq-group" key={g}>
                <h2>{g}</h2>
                <FaqAccordion items={items} defaultOpen={null} />
              </div>
            );
          })}
          <FaqJsonLd items={allFaqs} />
        </div>
      </section>
      <div className="container">
        <WhatsAppBand />
      </div>
    </>
  );
}
