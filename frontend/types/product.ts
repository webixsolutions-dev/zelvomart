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

export type Variant = {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  priceOverride?: number | null;
  stock: number;
  imageUrl?: string | null;
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
};

export type ProductListResponse = {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
