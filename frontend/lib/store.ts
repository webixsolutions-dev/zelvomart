import type { Category, Product, ProductListResponse } from '@/types/product';
import { apiFetch } from './api';
import { ALL_DUMMY_PRODUCTS, DEFAULT_CATEGORIES, DUMMY_PRODUCTS, getDisplayCategories } from './dummy-content';

export async function getCategories(): Promise<Category[]> {
  try {
    const rows = await apiFetch<Category[]>('/api/categories');
    return getDisplayCategories(rows || []);
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    return await apiFetch<Product>(`/api/products/slug/${encodeURIComponent(slug)}`);
  } catch {
    return ALL_DUMMY_PRODUCTS.find((product) => product.slug === slug) || null;
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

  return { items: pageItems, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getProducts(options: { category?: string; search?: string; page?: number; limit?: number; sort?: 'newest'|'price-asc'|'price-desc'; featured?: boolean } = {}): Promise<ProductListResponse> {
  const p = new URLSearchParams();
  if (options.category) p.set('category', options.category);
  if (options.search) p.set('search', options.search);
  if (options.page) p.set('page', String(options.page));
  if (options.limit) p.set('limit', String(options.limit));
  if (options.sort) p.set('sort', options.sort);
  if (options.featured) p.set('featured', 'true');

  try {
    const result = await apiFetch<ProductListResponse>(`/api/products?${p.toString()}`);
    if (result?.items?.length) return result;
    return dummyResult(options);
  } catch {
    return dummyResult(options);
  }
}
