export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  count?: number;
};

export type PriceSummary = {
  price: number;
  regularPrice: number;
  salePrice: number | null;
  onSale: boolean;
  saveAmount: number;
  discountPercent: number;
};

export type Variant = {
  pricing?: PriceSummary;
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  priceOverride?: number | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  stock: number;
  /** Can this variation be bought (lib/stock.ts on the backend). */
  stockStatus?: "instock" | "outofstock";
  /** Variation "Manage stock?": quantity is live and goes down with each order. */
  trackStock?: boolean;
  /** The status the admin picked for Manage stock OFF. */
  stockSetting?: "instock" | "outofstock";
  imageUrl?: string | null;
  images?: string[];
  gtin?: string | null;
  weight?: string;
  length?: string;
  width?: string;
  height?: string;
  enabled?: boolean;
  active: boolean;
};

export type Review = {
  id: string;
  name: string;
  rating: number;
  body: string;
  verified: boolean;
  createdAt: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  categories: Category[];
  categorySlugs: string[];
  price: number;
  regularPrice: number;
  salePrice?: number | null;
  onSale: boolean;
  discountPercent: number;
  saveAmount?: number;
  /** Can it be bought: one rule for products and variations (backend lib/stock.ts). */
  stockStatus: "instock" | "outofstock";
  trackStock?: boolean;
  /** The status the admin picked for Track stock OFF. */
  stockSetting?: "instock" | "outofstock";
  /** Live tracked quantity, or null when stock is not tracked. */
  stockQuantity: number | null;
  featured: boolean;
  orderCount?: number;
  averageRating?: number;
  reviewCount?: number;
  image?: string;
  images: { src: string; alt?: string; title?: string }[];
  /** Alt text and title set in the admin "Edit details" panel for the main product image. */
  imageAlt?: string | null;
  imageTitle?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  /** YouTube or Vimeo link (lib/product-video.ts). */
  videoUrl?: string | null;
  /** Thumbnail shown before the player loads (Vimeo's comes from oEmbed when the link is saved). */
  videoThumbnail?: string | null;
  /** When the link was added; the schema's VideoObject uploadDate. */
  videoAddedAt?: string | null;
  permalink?: string;
  hasOptions: boolean;
  variants: Variant[];
  bundleEnabled: boolean;
  bundleDiscountPercent?: number | null;
  reviews?: Review[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  tags?: string[];
  badges?: string[];
  freeShipping?: boolean;
  buyTwoDiscountPercent?: number;
  createdAt?: string;
  updatedAt?: string;
  catalogMeta?: {
    freeShipping?: boolean;
    productTabs?: Record<string, { override?: boolean; content?: string }>;
    redirectUrl?: string;
    [key: string]: unknown;
  } | null;
};

export type ProductListResponse = {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
