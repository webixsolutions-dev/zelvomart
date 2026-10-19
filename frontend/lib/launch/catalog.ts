/**
 * Design metadata and artwork only. Sellable products always come from the backend.
 */

export type CategoryId =
  | "home-living"
  | "home-decor"
  | "beauty"
  | "tech"
  | "fashion"
  | "fitness"
  | "kids";

export type Category = {
  id: CategoryId;
  /** URL segment, spelled out from `name` (e.g. Tech & Gadgets → tech-and-gadgets). */
  slug: string;
  name: string;
  short: string;
  tagline: string;
  intro: string;
  label: string;
  image: string;
  tile: string;
  banner: string;
  bannerMobile: string;
  seoTitle: string;
  seoDescription: string;
  /** Paragraph shown under the product grid on the category page. */
  about: string;
};

export type Variant = { name: string; swatch: string };

export type Product = {
  raw: import("@/types/product").Product;
  categoryName: string;
  categorySlug: string;
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: CategoryId;
  price: number;
  compare?: number;
  image: string;
  badge?: "Bestseller" | "New in" | "Popular" | "Gift pick" | "Limited";
  isNew?: boolean;
  isBestseller?: boolean;
  tagline: string;
  description: string;
  highlights: string[];
  idealFor: string[];
  specs: [string, string][];
  inBox: string[];
  variants?: { label: string; options: Variant[] };
  keywords: string[];
  /** Omitted products are treated as in stock. */
  inStock?: boolean;
  /** Meta title written for this product in the admin (without "| Zelvomart"). Falls back to "{name} Price in Pakistan". */
  seoTitle?: string;
  /** Meta description written for this product in the admin (140–155 characters). */
  seoDescription?: string;
};

const img = (name: string) => `/launch/images/products/${name}.webp`;

export const categories: Category[] = [
  {
    id: "home-living",
    slug: "home-and-living",
    name: "Home & Living",
    short: "Home & Living",
    tagline: "Practical essentials for everyday life.",
    intro:
      "Hydration, storage and the small upgrades that make busy homes run smoother — chosen for daily use, not just for the shelf.",
    label: "Daily essentials",
    image: "/launch/categories/home-living-600.webp",
    tile: "/launch/images/categories/home-living.webp",
    banner: "/launch/images/banners/desktop/category-home-living.webp",
    bannerMobile: "/launch/images/banners/mobile/category-home-living.webp",
    seoTitle: "Tumblers, Storage & Home Essentials in Pakistan",
    seoDescription:
      "Shop insulated tumblers, storage organisers and everyday home and kitchen essentials at Zelvomart, chosen for daily use. Order online across Pakistan.",
    about:
      "Zelvomart’s Home & Living range covers the things you reach for every day: insulated tumblers and drinkware, storage organisers, kitchen helpers and household essentials. Every product page lists the size, material and what comes in the box, so you know exactly what you are ordering. New pieces are added regularly as we find items that earn their place in a Pakistani home.",
  },
  {
    id: "home-decor",
    slug: "home-decor",
    name: "Home Decor",
    short: "Home Decor",
    tagline: "Beautiful details that feel like home.",
    intro:
      "Warm lighting, calming mist and quiet accents that turn a room into your favourite corner of the house.",
    label: "Refresh your space",
    image: "/launch/categories/home-decor-600.webp",
    tile: "/launch/images/categories/home-decor.webp",
    banner: "/launch/images/banners/desktop/category-home-decor.webp",
    bannerMobile: "/launch/images/banners/mobile/category-home-decor.webp",
    seoTitle: "Lamps, Humidifiers & Home Decor in Pakistan",
    seoDescription:
      "Table lamps, mist humidifiers and modern decor accents from Zelvomart that make any room feel calm and finished. Cash on Delivery across Pakistan.",
    about:
      "Home Decor at Zelvomart brings together table lamps, mist humidifiers, diffusers and decor accents for bedrooms, lounges and work corners. We choose pieces that look good and do a job, such as soft evening light or a calmer room. Each listing shows real photos, sizes and what is included, and our team on WhatsApp can help you choose.",
  },
  {
    id: "beauty",
    slug: "beauty-and-personal-care",
    name: "Beauty & Personal Care",
    short: "Beauty",
    tagline: "Everyday beauty and self-care picks.",
    intro:
      "Lip colour, fragrance and skincare edits for the routine you actually keep — with full details before you buy.",
    label: "Beauty staples",
    image: "/launch/categories/beauty-600.webp",
    tile: "/launch/images/categories/beauty.webp",
    banner: "/launch/images/banners/desktop/category-beauty.webp",
    bannerMobile: "/launch/images/banners/mobile/category-beauty.webp",
    seoTitle: "Lipgloss, Perfume & Skincare Online in Pakistan",
    seoDescription:
      "Shop lipgloss, perfume, makeup and daily skincare essentials at Zelvomart, with shade, size and full details on every product. Order online in Pakistan.",
    about:
      "Zelvomart’s Beauty & Personal Care range covers lipgloss, lip and eye pencils, perfume and everyday skincare. Every listing gives the shade or size, how to use it and what is in the pack, so you can choose with confidence. If you are unsure which shade suits you, message us on WhatsApp before you order.",
  },
  {
    id: "tech",
    slug: "tech-and-gadgets",
    name: "Tech & Gadgets",
    short: "Tech",
    tagline: "Smart tech for your everyday routine.",
    intro:
      "Wireless audio and wearables that earn their place in your day — for work calls, commutes and workouts.",
    label: "Useful gadgets",
    image: "/launch/categories/tech-600.webp",
    tile: "/launch/images/categories/tech.webp",
    banner: "/launch/images/banners/desktop/category-tech.webp",
    bannerMobile: "/launch/images/banners/mobile/category-tech.webp",
    seoTitle: "Earbuds, Smart Watches & Gadgets in Pakistan",
    seoDescription:
      "Buy wireless earbuds, headphones, smart watches and everyday gadgets at Zelvomart, with clear specs on every product. Order online or on WhatsApp.",
    about:
      "Tech & Gadgets at Zelvomart is for useful everyday tech: wireless earbuds, over-ear headphones, smart watches and handy gadgets for work, travel and home. Each product page lists battery life, connectivity and what is in the box, in plain language rather than jargon.",
  },
  {
    id: "fashion",
    slug: "fashion-accessories",
    name: "Fashion Accessories",
    short: "Fashion",
    tagline: "Accessories for every mood and moment.",
    intro:
      "Handbags, clutches and gift-ready jewellery that finish an outfit — from office days to wedding season.",
    label: "Wear your style",
    image: "/launch/categories/fashion-600.webp",
    tile: "/launch/images/categories/fashion.webp",
    banner: "/launch/images/banners/desktop/category-fashion.webp",
    bannerMobile: "/launch/images/banners/mobile/category-fashion.webp",
    seoTitle: "Handbags, Clutches & Jewellery Sets in Pakistan",
    seoDescription:
      "Shop women’s handbags, clutches and jewellery gift sets at Zelvomart, for office days, Eid and weddings. Cash on Delivery available all over Pakistan.",
    about:
      "Zelvomart’s Fashion Accessories range includes women’s handbags, clutches, jewellery sets and watch gift sets for everyday wear, office days and occasions like Eid and weddings. Each listing shows colours, sizes and exactly how many pieces come in a set, with real photos of the item.",
  },
  {
    id: "fitness",
    slug: "sports-and-fitness",
    name: "Sports & Fitness",
    short: "Fitness",
    tagline: "Make every move count.",
    intro:
      "Compact training gear for home workouts — grip trainers, mats and starter kits that fit in a corner of your room.",
    label: "Fitness favourites",
    image: "/launch/categories/fitness-600.webp",
    tile: "/launch/images/categories/fitness.webp",
    banner: "/launch/images/banners/desktop/category-fitness.webp",
    bannerMobile: "/launch/images/banners/mobile/category-fitness.webp",
    seoTitle: "Yoga Mats, Grippers & Fitness Gear in Pakistan",
    seoDescription:
      "Hand grippers, yoga mats and home workout gear from Zelvomart, compact enough for any room and built for daily training. Order online across Pakistan.",
    about:
      "Sports & Fitness at Zelvomart is built around home workouts and active days: hand grippers, yoga mats, workout kits and gear that fits a small space and a busy schedule. Every product page explains what it trains, how to use it safely and what comes in the box.",
  },
  {
    id: "kids",
    slug: "kids-and-toys",
    name: "Kids & Toys",
    short: "Kids",
    tagline: "More playful moments, more creativity.",
    intro:
      "Screen-free toys that build imagination — magnetic tiles, soft companions and gifts kids reach for again and again.",
    label: "Play & create",
    image: "/launch/categories/kids-600.webp",
    tile: "/launch/images/categories/kids.webp",
    banner: "/launch/images/banners/desktop/category-kids.webp",
    bannerMobile: "/launch/images/banners/mobile/category-kids.webp",
    seoTitle: "Kids Toys, Magnetic Tiles & Plush in Pakistan",
    seoDescription:
      "Magnetic building tiles, soft plush toys and screen-free toys for kids at Zelvomart, ideal for gifts. Shop online in Pakistan with Cash on Delivery.",
    about:
      "Kids & Toys at Zelvomart focuses on creative, screen-free play: magnetic building tiles, soft plush toys and learning toys that keep children busy and thinking. Each listing gives the suggested age, the number of pieces and safety notes, so parents know exactly what they are buying.",
  },
];

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug);
}

/** Public URL of a category page. */
export function categoryPath(id: string) {
  return `/category/${getCategory(id)?.slug ?? id}/`;
}

export function isOnSale(p: Product) { return !!p.compare && p.compare > p.price; }
export type CollectionKey = "shop" | "new-arrivals" | "bestsellers" | "deals";

export const collections: Record<
  CollectionKey,
  {
    title: string;
    /** Full <title> text, brand included (set with `title.absolute`). */
    seoTitle: string;
    eyebrow: string;
    sub: string;
    banner: string;
    bannerMobile: string;
    seoDescription: string;
    filter: (p: Product) => boolean;
  }
> = {
  shop: {
    title: "Shop All Products",
    seoTitle: "Shop All Products Online in Pakistan | Zelvomart",
    eyebrow: "The full Zelvomart edit",
    sub: "Every Zelvomart product in one place, across all seven categories.",
    banner: "/launch/extra/all-products-desktop.webp",
    bannerMobile: "/launch/products/all-products-mobile.webp",
    seoDescription:
      "Browse every Zelvomart product in one place: home, decor, beauty, tech, fashion, fitness and kids. Order online or on WhatsApp and pay on delivery.",
    filter: () => true,
  },
  "new-arrivals": {
    title: "New Arrivals",
    seoTitle: "New Arrivals: Latest Products in Pakistan | Zelvomart",
    eyebrow: "Just landed",
    sub: "The latest products added to Zelvomart, newest first.",
    banner: "/launch/extra/new-arrivals-desktop.webp",
    bannerMobile: "/launch/products/new-arrivals-mobile.webp",
    seoDescription:
      "See what’s new at Zelvomart: the latest products added across home, beauty, tech, fashion, fitness and kids, delivered to your door anywhere in Pakistan.",
    filter: (p) => !!p.isNew,
  },
  bestsellers: {
    title: "Bestsellers",
    seoTitle: "Bestsellers: Most-Ordered Products | Zelvomart",
    eyebrow: "Customer favourites",
    sub: "The products Zelvomart customers order, reorder and gift most.",
    banner: "/launch/extra/bestsellers-desktop.webp",
    bannerMobile: "/launch/products/bestsellers-mobile.webp",
    seoDescription:
      "Zelvomart bestsellers: the products customers order and reorder most, across home, beauty, fashion, kids and more. Cash on Delivery across Pakistan.",
    filter: (p) => !!p.isBestseller,
  },
  deals: {
    title: "Deals & Offers",
    seoTitle: "Deals & Discount Offers in Pakistan | Zelvomart",
    eyebrow: "Better finds, better prices",
    sub: "Genuine discounts on Zelvomart favourites, with the regular price always shown.",
    banner: "/launch/extra/deals-desktop.webp",
    bannerMobile: "/launch/products/deals-mobile.webp",
    seoDescription:
      "Current deals at Zelvomart: genuine discounts on home, beauty, fashion and kids’ favourites, with the regular price always shown. Order online in Pakistan.",
    filter: isOnSale,
  },
};
