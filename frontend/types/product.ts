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
  stockStatus?: "instock" | "outofstock" | "onbackorder";
  imageUrl?: string | null;
  images?: string[];
  gtin?: string | null;
  weight?: string;
  length?: string;
  width?: string;
  height?: string;
  shippingClass?: string;
  downloadable?: boolean;
  virtual?: boolean;
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
  stockStatus: "instock" | "outofstock";
  stockQuantity: number;
  featured: boolean;
  averageRating?: number;
  reviewCount?: number;
  image?: string;
  images: { src: string; alt?: string }[];
  shortDescription?: string | null;
  description?: string | null;
  videoUrl?: string | null;
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
  brand?: string | null;
  freeShipping?: boolean;
  buyTwoDiscountPercent?: number;
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
