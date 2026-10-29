/**
 * Mock catalog. Shape mirrors what the backend/API should eventually return,
 * so swapping this file for a fetch layer is the only change pages need.
 * Product photos are concept crops — replace with real SKU photography.
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
  /** URL segment: the WordPress category slug, kept so indexed URLs stay the same (e.g. Tech & Gadgets → tech-gadgets). */
  slug: string;
  name: string;
  short: string;
  tagline: string;
  intro: string;
  label: string;
  image: string;
  /** Full-size product gallery, including the main image. */
  gallery?: { src: string; alt?: string; title?: string }[];
  tile: string;
  banner: string;
  bannerMobile: string;
  seoTitle: string;
  seoDescription: string;
  /** Paragraph shown under the product grid on the category page. */
  about: string;
};

/** A colour or size option. `imageUrl` switches the gallery and shows an image swatch; `soldOut` crosses a size out. */
export type Variant = {
  name: string;
  swatch?: string;
  imageUrl?: string;
  images?: string[];
  soldOut?: boolean;
  /** Backend variant id and SKU, sent with the order. */
  id?: string;
  sku?: string;
  /** Variant price when it differs from the product price. */
  price?: number;
  /** Regular price of the variant when it is on sale (shown struck through). */
  compare?: number;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: CategoryId;
  price: number;
  compare?: number;
  image: string;
  /** Full-size product gallery, including the main image. */
  gallery?: { src: string; alt?: string; title?: string }[];
  badge?: "Bestseller" | "New in" | "Popular" | "Gift pick" | "Limited";
  isNew?: boolean;
  isBestseller?: boolean;
  tagline: string;
  description: string;
  /** Admin-authored rich description, retained so headings, emphasis and lists render as edited. */
  descriptionHtml?: string;
  highlights: string[];
  idealFor: string[];
  specs: [string, string][];
  inBox: string[];
  /** `kind` picks the layout; when omitted, labels containing "size" show size chips and everything else colour options. */
  variants?: { label: string; kind?: "colour" | "size"; options: Variant[] };
  /** "Choose your bundle" (Buy 1 / Buy 2) shows only when this is on. */
  bundleEnabled?: boolean;
  /** Discount on the Buy 2 bundle, in percent. */
  bundleDiscountPercent?: number;
  keywords: string[];
  /** Omitted products are treated as in stock. */
  inStock?: boolean;
  /** Admin-selected product-wide free shipping, separate from the cart threshold. */
  freeShipping?: boolean;
  /** Average of approved reviews (0–5) and how many there are. Omitted = no reviews yet. */
  rating?: number;
  reviewCount?: number;
  /** Approved reviews from the backend (product page only). */
  reviews?: import("./reviews").Review[];
  /** Meta title written for this product in the admin (without "| Zelvomart"). Falls back to "{name} Price in Pakistan". */
  seoTitle?: string;
  /** Meta description written for this product in the admin (140–155 characters). */
  seoDescription?: string;
  /** Admin → Product → SEO set to "noindex": the page tells search engines not to list it. */
  noindex?: boolean;
};

export const categories: Category[] = [
  {
    id: "home-living",
    slug: "home-living",
    name: "Home & Living",
    short: "Home & Living",
    tagline: "Practical essentials for everyday life.",
    intro:
      "Everyday essentials for the kitchen, storage and daily routines, chosen to make home life simpler.",
    label: "Daily essentials",
    image: "/categories/home-living-600.webp",
    tile: "/images/categories/home-living.webp",
    banner: "/images/banners/desktop/category-home-living.webp",
    bannerMobile: "/images/banners/mobile/category-home-living.webp",
    seoTitle: "Tumblers, Storage & Home Essentials in Pakistan",
    seoDescription:
      "Shop insulated tumblers, storage organisers and everyday home and kitchen essentials at Zelvomart, chosen for daily use. Order online across Pakistan.",
    about:
      "The Home & Living range at Zelvomart covers the things you reach for every day: insulated tumblers and drinkware, storage organisers, kitchen helpers and household essentials. Every product page lists the size, material and what comes in the box, so you know exactly what you are ordering. New pieces are added regularly as we find items that earn their place in a Pakistani home.",
  },
  {
    id: "home-decor",
    slug: "home-decor",
    name: "Home Decor",
    short: "Home Decor",
    tagline: "Beautiful details that feel like home.",
    intro:
      "Decor pieces that add warmth, light and character to bedrooms, lounges and work corners.",
    label: "Refresh your space",
    image: "/categories/home-decor-600.webp",
    tile: "/images/categories/home-decor.webp",
    banner: "/images/banners/desktop/category-home-decor.webp",
    bannerMobile: "/images/banners/mobile/category-home-decor.webp",
    seoTitle: "Lamps, Humidifiers & Home Decor in Pakistan",
    seoDescription:
      "Table lamps, mist humidifiers and modern decor accents from Zelvomart that make any room feel calm and finished. Cash on Delivery across Pakistan.",
    about:
      "The Home Decor range at Zelvomart brings together table lamps, mist humidifiers, diffusers and decor accents for bedrooms, lounges and work corners. We choose pieces that look good and do a job, such as soft evening light or a calmer room. Each listing shows real photos, sizes and what is included, and our team on WhatsApp can help you choose.",
  },
  {
    id: "beauty",
    slug: "beauty-personal-care",
    name: "Beauty & Personal Care",
    short: "Beauty",
    tagline: "Everyday beauty and self-care picks.",
    intro:
      "Makeup, fragrance and daily care essentials, with shade, size and usage details on every product.",
    label: "Beauty staples",
    image: "/categories/beauty-600.webp",
    tile: "/images/categories/beauty.webp",
    banner: "/images/banners/desktop/category-beauty.webp",
    bannerMobile: "/images/banners/mobile/category-beauty.webp",
    seoTitle: "Lipgloss, Perfume & Skincare Online in Pakistan",
    seoDescription:
      "Shop lipgloss, perfume, makeup and daily skincare essentials at Zelvomart, with shade, size and full details on every product. Order online in Pakistan.",
    about:
      "The Beauty & Personal Care range at Zelvomart covers lipgloss, lip and eye pencils, perfume and everyday skincare. Every listing gives the shade or size, how to use it and what is in the pack, so you can choose with confidence. If you are unsure which shade suits you, message us on WhatsApp before you order.",
  },
  {
    id: "tech",
    slug: "tech-gadgets",
    name: "Tech & Gadgets",
    short: "Tech",
    tagline: "Smart tech for your everyday routine.",
    intro:
      "Practical everyday tech for work, travel and home, explained in plain language.",
    label: "Useful gadgets",
    image: "/categories/tech-600.webp",
    tile: "/images/categories/tech.webp",
    banner: "/images/banners/desktop/category-tech.webp",
    bannerMobile: "/images/banners/mobile/category-tech.webp",
    seoTitle: "Earbuds, Smart Watches & Gadgets in Pakistan",
    seoDescription:
      "Buy wireless earbuds, headphones, smart watches and everyday gadgets at Zelvomart, with clear specs on every product. Order online or on WhatsApp.",
    about:
      "The Tech & Gadgets range at Zelvomart is for useful everyday tech: wireless earbuds, over-ear headphones, smart watches and handy gadgets for work, travel and home. Each product page lists battery life, connectivity and what is in the box, in plain language rather than jargon.",
  },
  {
    id: "fashion",
    slug: "fashion-accessories",
    name: "Fashion Accessories",
    short: "Fashion",
    tagline: "Accessories for every mood and moment.",
    intro:
      "Bags, jewellery and accessories for everyday wear, office days and special occasions.",
    label: "Wear your style",
    image: "/categories/fashion-600.webp",
    tile: "/images/categories/fashion.webp",
    banner: "/images/banners/desktop/category-fashion.webp",
    bannerMobile: "/images/banners/mobile/category-fashion.webp",
    seoTitle: "Handbags, Clutches & Jewellery Sets in Pakistan",
    seoDescription:
      "Shop women’s handbags, clutches and jewellery gift sets at Zelvomart, for office days, Eid and weddings. Cash on Delivery available all over Pakistan.",
    about:
      "The Fashion Accessories range at Zelvomart includes women’s handbags, clutches, jewellery sets and watch gift sets for everyday wear, office days and occasions like Eid and weddings. Each listing shows colours, sizes and exactly how many pieces come in a set, with real photos of the item.",
  },
  {
    id: "fitness",
    slug: "sports-fitness",
    name: "Sports & Fitness",
    short: "Fitness",
    tagline: "Make every move count.",
    intro:
      "Workout and fitness gear for home training and active days, compact enough for any space.",
    label: "Fitness favourites",
    image: "/categories/fitness-600.webp",
    tile: "/images/categories/fitness.webp",
    banner: "/images/banners/desktop/category-fitness.webp",
    bannerMobile: "/images/banners/mobile/category-fitness.webp",
    seoTitle: "Yoga Mats, Grippers & Fitness Gear in Pakistan",
    seoDescription:
      "Hand grippers, yoga mats and home workout gear from Zelvomart, compact enough for any room and built for daily training. Order online across Pakistan.",
    about:
      "The Sports & Fitness range at Zelvomart is built around home workouts and active days: hand grippers, yoga mats, workout kits and gear that fits a small space and a busy schedule. Every product page explains what it trains, how to use it safely and what comes in the box.",
  },
  {
    id: "kids",
    slug: "kids-toys",
    name: "Kids & Toys",
    short: "Kids",
    tagline: "More playful moments, more creativity.",
    intro:
      "Creative, screen-free toys and kids’ essentials that keep children playing and learning.",
    label: "Play & create",
    image: "/categories/kids-600.webp",
    tile: "/images/categories/kids.webp",
    banner: "/images/banners/desktop/category-kids.webp",
    bannerMobile: "/images/banners/mobile/category-kids.webp",
    seoTitle: "Kids Toys, Magnetic Tiles & Plush in Pakistan",
    seoDescription:
      "Magnetic building tiles, soft plush toys and screen-free toys for kids at Zelvomart, ideal for gifts. Shop online in Pakistan with Cash on Delivery.",
    about:
      "The Kids & Toys range at Zelvomart focuses on creative, screen-free play: magnetic building tiles, soft plush toys and learning toys that keep children busy and thinking. Each listing gives the suggested age, the number of pieces and safety notes, so parents know exactly what they are buying.",
  },
];

/**
 * Products come from the backend (GET /api/products). The server fills this list with
 * `loadCatalog()` (lib/backend.ts) and the browser gets the same list from the store layout
 * (CatalogBridge), so every helper below keeps working unchanged.
 */
export const products: Product[] = [];

/** Replace the product list in place (keeps the same array, so every importer sees the update). */
export function setCatalog(items: Product[]) {
  if (products === items) return;
  products.splice(0, products.length, ...items);
}

/** Add or replace single products (e.g. the full product on its own page). */
export function upsertProducts(items: Product[]) {
  for (const item of items) {
    const at = products.findIndex((p) => p.id === item.id);
    if (at >= 0) products[at] = item;
    else products.push(item);
  }
}

/** Backend category slug → design category id (design URLs keep the design slugs). */
export const backendCategorySlugs: Record<CategoryId, string> = {
  "home-living": "home-living",
  "home-decor": "home-decor",
  beauty: "beauty-personal-care",
  tech: "tech-gadgets",
  fashion: "fashion-accessories",
  fitness: "sports-fitness",
  kids: "kids-toys",
};

export function designCategoryId(backendSlug: string | undefined | null): CategoryId {
  const slug = String(backendSlug || "");
  const exact = (Object.keys(backendCategorySlugs) as CategoryId[]).find((id) => backendCategorySlugs[id] === slug || id === slug);
  if (exact) return exact;
  const byDesignSlug = categories.find((c) => c.slug === slug);
  if (byDesignSlug) return byDesignSlug.id;
  if (/beauty|cosmetic|skin|makeup/.test(slug)) return "beauty";
  if (/tech|gadget|electronic/.test(slug)) return "tech";
  if (/fashion|jewel|bag|watch|accessor/.test(slug)) return "fashion";
  if (/sport|fitness|gym/.test(slug)) return "fitness";
  if (/kid|toy|baby/.test(slug)) return "kids";
  if (/decor/.test(slug)) return "home-decor";
  return "home-living";
}

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug);
}

/** Public URL of a category page. */
export function categoryPath(id: string) {
  return `/product-category/${getCategory(id)?.slug ?? id}/`;
}

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function getProductById(id: string) {
  return products.find((p) => p.id === id);
}

export function productsIn(category: CategoryId) {
  return products.filter((p) => p.category === category);
}

export function isOnSale(p: Product) {
  return !!p.compare && p.compare > p.price;
}

/** "You may also like": same category first (current product left out), topped up with bestsellers. */
export function relatedProducts(p: Product, n = 4) {
  const same = products.filter((x) => x.category === p.category && x.id !== p.id);
  const best = products.filter((x) => x.isBestseller && x.id !== p.id && x.category !== p.category);
  const rest = products.filter((x) => x.id !== p.id && x.category !== p.category && !x.isBestseller);
  return [...same, ...best, ...rest].slice(0, n);
}

export function searchProducts(q: string) {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return products
    .map((p) => {
      const cat = getCategory(p.category)!;
      const hay = [p.name, cat.name, p.tagline, ...p.keywords].join(" ").toLowerCase();
      const score = terms.reduce(
        (s, t) => s + (p.name.toLowerCase().includes(t) ? 3 : 0) + (hay.includes(t) ? 1 : 0),
        0,
      );
      return { p, score, all: terms.every((t) => hay.includes(t)) };
    })
    .filter((r) => r.all)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.p);
}

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
    banner: "/extra/all-products-desktop.webp",
    bannerMobile: "/products/all-products-mobile.webp",
    seoDescription:
      "Browse every Zelvomart product in one place: home, decor, beauty, tech, fashion, fitness and kids. Order online or on WhatsApp and pay on delivery.",
    filter: () => true,
  },
  "new-arrivals": {
    title: "New Arrivals",
    seoTitle: "New Arrivals: Latest Products in Pakistan | Zelvomart",
    eyebrow: "Just landed",
    sub: "The latest additions to Zelvomart, newest first.",
    banner: "/extra/new-arrivals-desktop.webp",
    bannerMobile: "/products/new-arrivals-mobile.webp",
    seoDescription:
      "See what’s new at Zelvomart: the latest products added across home, beauty, tech, fashion, fitness and kids, delivered to your door anywhere in Pakistan.",
    filter: (p) => !!p.isNew,
  },
  bestsellers: {
    title: "Bestsellers",
    seoTitle: "Bestsellers: Most-Ordered Products | Zelvomart",
    eyebrow: "Customer favourites",
    sub: "The products Zelvomart customers order, reorder and gift most.",
    banner: "/extra/bestsellers-desktop.webp",
    bannerMobile: "/products/bestsellers-mobile.webp",
    seoDescription:
      "Zelvomart bestsellers: the products customers order and reorder most, across home, beauty, fashion, kids and more. Cash on Delivery across Pakistan.",
    filter: (p) => !!p.isBestseller,
  },
  deals: {
    title: "Deals & Offers",
    seoTitle: "Deals & Discount Offers in Pakistan | Zelvomart",
    eyebrow: "Better finds, better prices",
    sub: "Genuine discounts across our categories, with the regular price always shown.",
    banner: "/extra/deals-desktop.webp",
    bannerMobile: "/products/deals-mobile.webp",
    seoDescription:
      "Current deals at Zelvomart: genuine discounts on home, beauty, fashion and kids’ favourites, with the regular price always shown. Order online in Pakistan.",
    filter: isOnSale,
  },
};
