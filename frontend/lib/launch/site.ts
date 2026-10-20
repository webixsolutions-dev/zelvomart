/**
 * Store-wide settings. Everything a non-developer may need to change lives here:
 * contact details, shipping rules and the copy that appears in trust badges.
 * Values marked "verify" must be confirmed by operations before launch.
 */
export const site = {
  name: "Zelvomart",
  tagline: "Everyday things, chosen better.",
  description:
    "Zelvomart is an online store in Pakistan for home, decor, beauty, tech, fashion, fitness and kids’ products. Order online or on WhatsApp, pay on delivery.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.vercel.app").replace(/\/$/,""), // verify: production domain
  locale: "en_PK",
  currency: "PKR",
  city: "Lahore, Pakistan",
  email: "support@zelvomart.com",
  phoneDisplay: "+92 300 2026711",
  whatsappNumber: "923002026711",
  supportHours: "Mon–Sat, 10am – 7pm", // verify
  foundingDate: "2026-07",
  founder: "Sehar Faryal", // co-founder
  // Official profiles (decided 19 Oct 2026). Footer icons and Organization `sameAs` both read this list.
  social: {
    facebook: "https://www.facebook.com/zelvomart/",
    instagram: "https://www.instagram.com/zelvomart",
    pinterest: "https://www.pinterest.com/zelvomartpk/",
    linkedin: "https://www.linkedin.com/company/zelvomart",
    x: "https://x.com/zelvomart",
    tiktok: "https://www.tiktok.com/@zelvomart",
    youtube: "https://www.youtube.com/@ZelvoMart",
  },
  shipping: {
    flatFee: 190, // decided 19 Oct 2026
    freeOver: 8000, // decided 19 Oct 2026
    estimate: "2–7 working days", // still to be set by operations (per-city days)
    courier: "PostEx",
    majorCityEstimate: "2–3 working days",
  },
  returns: {
    windowDays: 7, // still to be set by operations
  },
  // Brand-store positioning: stock is held and shipped by Zelvomart itself.
  fulfilment: {
    warehouse: "Lahore",
    dispatch: "Dispatched within 24 hours", // verify against ops
  },
} as const;

export const announcements = [
  "Cash on Delivery across Pakistan",
  `Free delivery on orders over Rs. ${site.shipping.freeOver.toLocaleString("en-PK")}`,
  "Every order checked before dispatch",
  "Real people on WhatsApp — ask before you buy",
];
