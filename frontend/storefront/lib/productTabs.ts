import type { Product } from "./catalog";
import { getCategory } from "./catalog";
import { site } from "./site";

/**
 * Product page detail sections, mirroring the admin's Product tabs (`resolveProductTabs`).
 * Store-wide tabs come from Settings; any section with no content is left out.
 */
export type ProductTab =
  | { id: "description"; label: string }
  | { id: "why"; label: string; points: { title: string; text: string }[] }
  | { id: "shipping"; label: string; steps: { title: string; text: string }[]; note: string }
  | { id: "faq"; label: string; items: { q: string; a: string }[] }
  | { id: "info"; label: string; rows: [string, string][] };

export function resolveProductTabs(p: Product): ProductTab[] {
  const cat = getCategory(p.category);
  const { estimate, flatFee, freeOver, courier } = site.shipping;
  const free = `Rs. ${freeOver.toLocaleString("en-PK")}`;
  const rows: [string, string][] = [
    ...(cat ? ([["Category", cat.name]] as [string, string][]) : []),
    ...p.specs,
    ...(p.variants ? ([[`${p.variants.label} options`, p.variants.options.map((o) => o.name).join(", ")]] as [string, string][]) : []),
    ["SKU", p.sku],
  ];
  const tabs: ProductTab[] = [
    { id: "description", label: "Description" },
    {
      id: "why",
      label: "Why Choose Zelvomart",
      points: [
        { title: "From our own stock", text: "Every product listed is in our own stock, ready to pack and ship. We don’t list anything we don’t actually have." },
        { title: "Checked before dispatch", text: "Each item is inspected and packed with care before it leaves us." },
        { title: "Cash on Delivery", text: "Pay in cash when your parcel arrives, anywhere in Pakistan." },
        { title: "Real people on WhatsApp", text: `Ask about size, colour or delivery before you order. Our team replies ${site.supportHours}.` },
      ],
    },
    {
      id: "shipping",
      label: "Shipping Process",
      steps: [
        { title: "Order placed", text: "Place your order on the website or on WhatsApp." },
        { title: "Confirmation", text: "We call or WhatsApp you to confirm your address." },
        { title: "Dispatched", text: `Packed and handed to ${courier} within 24–48 hours.` },
        { title: "Delivered", text: `Arrives in ${estimate}. Pay cash on delivery.` },
      ],
      note: `Delivery is Rs. ${flatFee} per order, or free on orders over ${free}. Please record a video while opening your parcel; it helps us sort out any issue quickly.`,
    },
    {
      id: "faq",
      label: "General FAQ",
      items: [
        { q: "Will the product I receive match the photos?", a: "Yes. It is the exact same product from our own stock, shown from different angles so you can see it before you decide." },
        { q: "How long does delivery take?", a: `Usually ${estimate} depending on your city, delivered through ${courier}.` },
        { q: "Do I have to pay before delivery?", a: "No. With Cash on Delivery you pay only when your order arrives at your door." },
        { q: "What if something is wrong with my order?", a: `If an item arrives damaged, wrong or incomplete, message us within ${site.returns.windowDays} days of delivery with your opening video and we’ll refund or replace it.` },
      ],
    },
    { id: "info", label: "Additional information", rows },
  ];
  return tabs.filter((t) => {
    if (t.id === "info") return t.rows.length > 0;
    if (t.id === "faq") return t.items.length > 0;
    return true;
  });
}
