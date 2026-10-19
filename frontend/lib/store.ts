import type { Category, Product, ProductListResponse } from '@/types/product';
import { apiFetch } from './api';
import { DEFAULT_CATEGORIES, getDisplayCategories } from './dummy-content';
import { withProductMedia } from './product-media';

export type MenuProduct = {
  name: string;
  slug: string;
  categorySlugs: string[];
};

export type StoreBootstrap = {
  categories: Category[];
  settings: Record<string, unknown>;
};

export async function getStoreBootstrap(): Promise<StoreBootstrap> {
  try {
    const result = await apiFetch<StoreBootstrap>('/api/store/bootstrap', {
      next: { revalidate: 30, tags: ['store', 'categories', 'settings'] },
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
    return null;
  }
}

export async function getProducts(options: { category?: string; search?: string; page?: number; limit?: number; sort?: 'popular'|'newest'|'price-asc'|'price-desc'; featured?: boolean; minPrice?: number; maxPrice?: number; availability?: 'instock'; tag?: string } = {}): Promise<ProductListResponse> {
  const p = new URLSearchParams();
  if (options.category) p.set('category', options.category);
  if (options.search) p.set('search', options.search);
  if (options.page) p.set('page', String(options.page));
  if (options.limit) p.set('limit', String(options.limit));
  if (options.sort) p.set('sort', options.sort);
  if (options.featured) p.set('featured', 'true');
  if (options.minPrice != null) p.set('minPrice', String(options.minPrice));
  if (options.maxPrice != null) p.set('maxPrice', String(options.maxPrice));
  if (options.availability) p.set('availability', options.availability);
  if (options.tag) p.set('tag', options.tag);

  const tags = ['products'];
  if (options.category) tags.push(`category:${options.category}`);
  if (options.featured) tags.push('featured-products');

  try {
    const result = await apiFetch<ProductListResponse>(`/api/products?${p.toString()}`, {
      next: { revalidate: 120, tags },
    });
    return {
      ...result,
      items: Array.isArray(result?.items) ? result.items.map(withProductMedia) : [],
      page: result?.page || options.page || 1,
      limit: result?.limit || options.limit || 12,
      total: result?.total || 0,
      totalPages: Math.max(1, result?.totalPages || 1),
    };
  } catch (error) {
    return {items:[],page:options.page||1,limit:options.limit||12,total:0,totalPages:1};
  }
}

export async function getMenuProducts(): Promise<MenuProduct[]> {
  const collected: MenuProduct[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await getProducts({ page, limit: 100, sort: 'newest' });
    collected.push(
      ...result.items.map((product) => ({
        name: product.name,
        slug: product.slug,
        categorySlugs: product.categorySlugs?.length
          ? product.categorySlugs
          : (product.categories || []).map((category) => category.slug),
      })),
    );
    totalPages = result.totalPages || 1;
    if (!result.items.length) break;
    page += 1;
  } while (page <= totalPages && page <= 8);

  const unique = new Map<string, MenuProduct>();
  for (const product of collected) unique.set(product.slug, product);
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}
