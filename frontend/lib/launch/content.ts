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

/** Shown on the home page, in this order (and first on the FAQ page). */
export const homeFaqs: Faq[] = [
  whatIsZelvomart,
  {
    group: "About Zelvomart",
    q: "How do I know this is a real store and not a scam?",
    a: "Zelvomart is a real, working store. Every product shown here is in our own stock, ready to pack and ship; we don’t list anything we don’t actually have. Behind the site is real inventory and a real team. With Cash on Delivery you pay only once your order is in your hands, so there’s no risk in giving us a try.",
  },
  {
    group: "Payments",
    q: "Do I have to pay anything before I receive my order?",
    a: "No. With Cash on Delivery you pay only when your order arrives at your door. Online payment options will be added soon for customers who prefer to pay in advance, and Cash on Delivery will always stay available.",
  },
  {
    group: "Delivery",
    q: "How long does delivery take?",
    a: `Usually ${site.shipping.estimate} depending on your city, delivered through ${site.shipping.courier}. We confirm your order on WhatsApp before it is dispatched.`,
  },
  {
    group: "Returns",
    q: "What if something is wrong with my order?",
    a: "If an item arrives damaged, wrong or incomplete, we’ll refund or replace it. Please record a video while opening your parcel, from start to finish, before taking the item out. That video lets us sort any issue quickly and fairly, so please make it a habit with every order.",
  },
];

/** The rest of the FAQ page (after the home questions). */
export const faqs: Faq[] = [
  {
    group: "Orders",
    q: "Can I order without using the website?",
    a: `Yes. Message us on WhatsApp at ${site.phoneDisplay}, or on Facebook or Instagram, with the product name and your city, and we’ll place the order for you.`,
  },
  {
    group: "Products",
    q: "Will the product I receive match the photos?",
    a: "Yes. It is the exact same product from our own stock. The main photo shows it clearly, and every listing has 2–3 photos so you can see it from different angles before you decide.",
  },
  {
    group: "Products",
    q: "Are your beauty and personal care products genuine and safe?",
    a: "Yes. We check every beauty product before it comes into our stock and only carry items we’re confident are safe to use.",
  },
  {
    group: "Products",
    q: "Are your gadgets and electronics original, not copies?",
    a: "Yes. We check every gadget before it goes into our stock and only carry quality items.",
  },
  {
    group: "Delivery",
    q: "How much is delivery?",
    a: `Standard delivery is ${fee} per order, and free on orders over ${freeOver}. The exact charge is always shown in your cart before you place the order.`,
  },
  {
    group: "Payments",
    q: "Do you offer Cash on Delivery?",
    a: "Yes. Cash on Delivery is available on eligible orders across Pakistan — you pay the rider in cash when your parcel arrives. Your available payment options are confirmed at checkout.",
  },
  {
    group: "Orders",
    q: "How can I track my order?",
    a: "Use the Track Order page with your order number and the phone number used at checkout. Once your parcel is with the courier, we'll also share the courier tracking number on WhatsApp/SMS.",
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

/** Every FAQ, home questions first, then the brand group and the rest — the FAQ page and its FAQPage schema read this list. */
export const allFaqs: Faq[] = [...homeFaqs, ...brandFaqs.filter((f) => f !== whatIsZelvomart), ...faqs];

// Policy page copy is maintained separately in lib/policies/.
