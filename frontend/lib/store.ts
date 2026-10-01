import type { Category, Product, ProductListResponse } from '@/types/product';
import { apiFetch } from './api';
import { ALL_DUMMY_PRODUCTS, DEFAULT_CATEGORIES, DUMMY_PRODUCTS, getDisplayCategories } from './dummy-content';
import { withProductMedia } from './product-media';

export type StoreBootstrap = {
  categories: Category[];
  settings: Record<string, unknown>;
};

export async function getStoreBootstrap(): Promise<StoreBootstrap> {
  try {
    const result = await apiFetch<StoreBootstrap>('/api/store/bootstrap', {
      next: { revalidate: 300, tags: ['store', 'categories', 'settings'] },
    });
    return {
      categories: getDisplayCategories(result.categories || []),
      settings: result.settings || {},
    };
  } catch {
    return { categories: DEFAULT_CATEGORIES, settings: {} };
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const rows = await apiFetch<Category[]>('/api/categories', {
      next: { revalidate: 900, tags: ['categories'] },
    });
    return getDisplayCategories(rows || []);
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const product = await apiFetch<Product>(`/api/products/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120, tags: ['products', `product:${slug}`] },
    });
    return withProductMedia(product);
  } catch {
    const fallback = ALL_DUMMY_PRODUCTS.find((product) => product.slug === slug) || null;
    return fallback ? withProductMedia(fallback) : null;
  }
}

function dummyResult(options: { category?: string; search?: string; page?: number; limit?: number; sort?: 'newest'|'price-asc'|'price-desc'; featured?: boolean } = {}): ProductListResponse {
  let items = options.category ? (DUMMY_PRODUCTS[options.category] || []) : ALL_DUMMY_PRODUCTS;

  if (options.search) {
    const q = options.search.toLowerCase();
    items = items.filter((product) => `${product.name} ${product.categories.map((category) => category.name).join(' ')}`.toLowerCase().includes(q));
  }

  if (options.featured) items = DUMMY_PRODUCTS.best;
  if (options.sort === 'price-asc') items = [...items].sort((a, b) => a.price - b.price);
  if (options.sort === 'price-desc') items = [...items].sort((a, b) => b.price - a.price);

  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, options.limit || 12);
  const total = items.length;
  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);

  return { items: pageItems.map(withProductMedia), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getProducts(options: { category?: string; search?: string; page?: number; limit?: number; sort?: 'newest'|'price-asc'|'price-desc'; featured?: boolean } = {}): Promise<ProductListResponse> {
  const p = new URLSearchParams();
  if (options.category) p.set('category', options.category);
  if (options.search) p.set('search', options.search);
  if (options.page) p.set('page', String(options.page));
  if (options.limit) p.set('limit', String(options.limit));
  if (options.sort) p.set('sort', options.sort);
  if (options.featured) p.set('featured', 'true');

  const tags = ['products'];
  if (options.category) tags.push(`category:${options.category}`);
  if (options.featured) tags.push('featured-products');

  try {
    const result = await apiFetch<ProductListResponse>(`/api/products?${p.toString()}`, {
      next: { revalidate: 120, tags },
    });
    if (result?.items?.length) return { ...result, items: result.items.map(withProductMedia) };
    return dummyResult(options);
  } catch {
    return dummyResult(options);
  }
}
