import type { Category, Product, ProductListResponse } from "@/types/product";

type CatalogOptions = {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "popular" | "newest" | "price-asc" | "price-desc";
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  availability?: "instock";
  tag?: string;
};

const category = (slug: string, name: string): Category => ({
  id: `site-${slug}`,
  name,
  slug,
});

const FASHION = category("fashion-accessories", "Fashion Accessories");
const KIDS = category("kids-toys", "Kids & Toys");
const TECH = category("tech-gadgets", "Tech & Gadgets");
const DECOR = category("home-decor", "Home Decor");
const SPORTS = category("sports-fitness", "Sports & Fitness");
const BEAUTY = category("beauty-personal-care", "Beauty & Personal Care");

function catalogProduct(
  slug: string,
  name: string,
  regularPrice: number,
  image: string,
  categories: Category[],
  salePrice?: number,
): Product {
  const currentPrice = salePrice ?? regularPrice;
  const onSale = salePrice != null && salePrice < regularPrice;
  return {
    id: `site-${slug}`,
    slug,
    name,
    sku: slug.toUpperCase(),
    categories,
    categorySlugs: categories.map((item) => item.slug),
    price: currentPrice,
    regularPrice,
    salePrice: onSale ? salePrice : null,
    onSale,
    discountPercent: onSale ? Math.round(((regularPrice - currentPrice) / regularPrice) * 100) : 0,
    stockStatus: "instock",
    stockQuantity: 20,
    featured: false,
    averageRating: 4.8,
    reviewCount: 12,
    image,
    images: [{ src: image, alt: name }],
    shortDescription: `${name} available with Cash on Delivery across Pakistan.`,
    description: `<p>${name} is available from Zelvomart with clear pricing and Cash on Delivery across Pakistan.</p>`,
    hasOptions: false,
    variants: [],
    bundleEnabled: false,
    reviews: [],
    permalink: `/product/${slug}/`,
  };
}

/** Published products currently listed on zelvomart.com. */
export const SITE_CATALOG: Product[] = [
  catalogProduct("rhinestone-watch-and-bracelet-set-3-pieces", "Rhinestone Watch and Bracelet Set, 3 Pieces", 2999, "/images/products/legacy/rhinestone-watch-and-bracelet-set-3-pieces.webp", [FASHION], 2399),
  catalogProduct("complete-jewellery-set-with-watch-4-pieces", "Complete Jewellery Set with Watch, 4 Pieces", 3499, "/images/products/legacy/complete-jewellery-set-with-watch-4-pieces.webp", [FASHION], 2799),
  catalogProduct("double-bracelet-set-with-watch-3-pieces", "Double Bracelet Set with Watch, 3 Pieces", 3449, "/images/products/legacy/double-bracelet-set-with-watch-3-pieces.webp", [FASHION], 2749),
  catalogProduct("bangle-and-bracelet-set-with-watch-3-pieces", "Bangle and Bracelet Set with Watch, 3 Pieces", 3249, "/images/products/legacy/bangle-and-bracelet-set-with-watch-3-pieces.webp", [FASHION], 2649),
  catalogProduct("heart-pendant-jewellery-set-with-watch-4-pieces", "Heart Pendant Jewellery Set with Watch, 4 Pieces", 2744, "/images/products/legacy/heart-pendant-jewellery-set-with-watch-4-pieces.webp", [FASHION], 2149),
  catalogProduct("textured-handbag-with-shoulder-strap", "Textured Handbag with Shoulder Strap", 4949, "/images/products/legacy/textured-handbag-with-shoulder-strap.webp", [FASHION], 4199),
  catalogProduct("magnetic-building-blocks-set-42-pieces", "Magnetic Building Blocks Set, 42 Pieces", 2349, "/images/products/legacy/magnetic-building-blocks-set-42-pieces.webp", [KIDS]),
  catalogProduct("1200ml-insulated-tumbler-with-handle", "1200ML Insulated Tumbler with Handle", 3944, "/images/products/legacy/1200ml-insulated-tumbler-with-handle.webp", [], 3149),
  catalogProduct("pink-marble-insulated-tumbler-1200ml", "Pink Marble Insulated Tumbler, 1200ml", 4189, "/images/products/legacy/pink-marble-insulated-tumbler-1200ml.webp", [], 3399),
  catalogProduct("colour-changing-h2o-humidifier-with-mist", "Colour-Changing H2O Humidifier with Mist", 2499, "/images/products/legacy/colour-changing-h2o-humidifier-with-mist.webp", [TECH, DECOR], 1999),
  catalogProduct("cordless-neck-shoulder-kneading-massager", "Cordless Neck & Shoulder Kneading Massager", 6499, "/images/products/legacy/cordless-neck-shoulder-kneading-massager.jpeg", [SPORTS]),
  catalogProduct("silicone-sink-splash-guard", "Silicone Sink Splash Guard", 999, "/images/products/legacy/silicone-sink-splash-guard.jpeg", []),
  catalogProduct("adjustable-hand-gripper", "Adjustable Hand Gripper", 1499, "/images/products/legacy/adjustable-hand-gripper.jpeg", [SPORTS]),
  catalogProduct("emelie-matte-liquid-lipgloss", "Emelie Matte Liquid Lipgloss", 999, "/images/products/legacy/emelie-matte-liquid-lipgloss.jpeg", [BEAUTY]),
  catalogProduct("emelie-paris-matte-lip-eye-pencil", "Emelie Paris Matte Lip & Eye Pencil", 999, "/images/products/legacy/emelie-paris-matte-lip-eye-pencil.jpeg", [BEAUTY]),
  catalogProduct("emelie-paris-waterproof-matte-eyeliner", "Emelie Paris Matte Maker Eyeliner", 999, "/images/products/legacy/emelie-paris-waterproof-matte-eyeliner.webp", [BEAUTY]),
];

export function findSiteProduct(slug: string): Product | null {
  return SITE_CATALOG.find((product) => product.slug === slug) || null;
}

export function siteCatalogResponse(options: CatalogOptions = {}): ProductListResponse {
  let items = [...SITE_CATALOG];

  if (options.category) {
    items = items.filter((product) => product.categorySlugs.includes(options.category || ""));
  }

  if (options.search) {
    const query = options.search.toLowerCase();
    items = items.filter((product) =>
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.categories.some((item) => item.name.toLowerCase().includes(query)),
    );
  }

  if (options.featured) items = items.filter((product) => product.featured);
  if (options.minPrice != null) items = items.filter((product) => product.price >= (options.minPrice || 0));
  if (options.maxPrice != null) items = items.filter((product) => product.price <= (options.maxPrice || 0));
  if (options.availability === "instock") items = items.filter((product) => product.stockStatus === "instock");
  if (options.tag === "discount") items = items.filter((product) => product.onSale);
  else if (options.tag === "best-selling") items = items.filter((product) => product.featured);
  else if (options.tag) items = items.filter((product) => (product.tags || []).includes(options.tag || ""));

  if (options.sort === "price-asc") items.sort((a, b) => a.price - b.price);
  else if (options.sort === "price-desc") items.sort((a, b) => b.price - a.price);
  else if (options.sort === "newest") items.reverse();
  else items.sort((a, b) => a.name.localeCompare(b.name));

  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, options.limit || 12);
  const total = items.length;
  const start = (page - 1) * limit;

  return {
    items: items.slice(start, start + limit),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

