import { site } from "./site";

const fee = `Rs. ${site.shipping.flatFee}`;
const freeOver = `Rs. ${site.shipping.freeOver.toLocaleString("en-PK")}`;

type Faq = { q: string; a: string; group: "About Zelvomart" | "Orders" | "Delivery" | "Payments" | "Returns" | "Products" };

/** The plain-language answer to "What is Zelvomart?" — used on the home page and the FAQ page, and read by search engines and AI assistants. */
export const whatIsZelvomart: Faq = {
  group: "About Zelvomart",
  q: "What is Zelvomart?",
  a: "Zelvomart is an online store based in Lahore, Pakistan, selling everyday products in seven categories: home and living, home decor, beauty and personal care, tech and gadgets, fashion accessories, sports and fitness, and kids and toys. Every order is checked before dispatch and delivered across Pakistan.",
};

/** Brand questions shown first on the FAQ page. */
export const brandFaqs: Faq[] = [
  whatIsZelvomart,
  {
    group: "About Zelvomart",
    q: "Where is Zelvomart based?",
    a: "Zelvomart is based in Lahore and delivers across Pakistan.",
  },
  {
    group: "About Zelvomart",
    q: "Is Zelvomart a genuine store?",
    a: `Yes. You pay in cash only when your parcel arrives, every order is checked before dispatch, and a real person answers on WhatsApp at ${site.phoneDisplay}. Reviews on product pages come only from customers with a delivered order.`,
  },
  {
    group: "About Zelvomart",
    q: "What payment methods do you accept?",
    a: "Cash on Delivery today. Online payment options will be added later.",
  },
  {
    group: "About Zelvomart",
    q: "How do I contact Zelvomart?",
    a: `WhatsApp or call ${site.phoneDisplay}, or email ${site.email}, Monday to Saturday.`,
  },
];

export const faqs: Faq[] = [
  {
    group: "Payments",
    q: "Do you offer Cash on Delivery?",
    a: "Yes. Cash on Delivery is available on eligible orders across Pakistan — you pay the rider in cash when your parcel arrives. Your available payment options are confirmed at checkout.",
  },
  {
    group: "Delivery",
    q: "How long does delivery take?",
    a: `Most orders arrive within ${site.shipping.estimate}. Major cities such as Lahore, Karachi and Islamabad are usually faster (${site.shipping.majorCityEstimate}). You'll receive a confirmation call or message before dispatch.`,
  },
  {
    group: "Delivery",
    q: "How much is delivery?",
    a: `Standard delivery is ${fee} per order, and free on orders over ${freeOver}. The exact charge is always shown in your cart before you place the order.`,
  },
  {
    group: "Orders",
    q: "How can I track my order?",
    a: "Use the Track Order page with your order number and the phone number used at checkout. Once your parcel is with the courier, we'll also share the courier tracking number on WhatsApp/SMS.",
  },
  {
    group: "Products",
    q: "Will the item match the photos?",
    a: "We list clear specifications, sizes and variants for every product. If anything is unclear — size, colour, contents — message us on WhatsApp before ordering and we'll send you real photos.",
  },
  {
    group: "Returns",
    q: "What if I receive a wrong or damaged item?",
    a: `Contact us within ${site.returns.windowDays} days of delivery with your order number and a photo or unboxing video. We'll arrange a replacement or refund as per our Returns & Exchange policy.`,
  },
  {
    group: "Orders",
    q: "Can I order on WhatsApp?",
    a: `Absolutely. Tap any "Order on WhatsApp" button or message us directly on ${site.phoneDisplay} — our team will confirm the product, variant and delivery details with you.`,
  },
  {
    group: "Orders",
    q: "Can I change or cancel my order?",
    a: "Yes, as long as it hasn't been dispatched. Message us on WhatsApp with your order number as soon as possible and we'll update it for you.",
  },
  {
    group: "Delivery",
    q: "Do you deliver internationally?",
    a: "Not yet — we currently deliver within Pakistan only. International shipping will be announced here once destinations, rates and payment options are live.",
  },
];

const pick = (q: string) => faqs.find((f) => f.q === q)!;

/** Home page FAQ: brand first, then the four questions buyers ask before ordering. */
export const homeFaqs: Faq[] = [
  whatIsZelvomart,
  pick("Do you offer Cash on Delivery?"),
  pick("How long does delivery take?"),
  pick("How much is delivery?"),
  pick("Can I order on WhatsApp?"),
];

// Policy page copy is maintained separately in lib/policies/.
