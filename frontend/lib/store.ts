import type { Category, Product } from '@/types/product';
import { apiFetch } from './api';

export async function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/api/categories');
}
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try { return await apiFetch<Product>(`/api/products/slug/${encodeURIComponent(slug)}`); } catch { return null; }
}
export async function getProducts(options: { category?: string; search?: string; page?: number; limit?: number; sort?: 'newest'|'price-asc'|'price-desc'; featured?: boolean } = {}) {
  const p = new URLSearchParams();
  if(options.category)p.set('category',options.category); if(options.search)p.set('search',options.search); if(options.page)p.set('page',String(options.page)); if(options.limit)p.set('limit',String(options.limit)); if(options.sort)p.set('sort',options.sort); if(options.featured)p.set('featured','true');
  return apiFetch<{items:Product[];page:number;limit:number;total:number;totalPages:number}>(`/api/products?${p.toString()}`);
}
