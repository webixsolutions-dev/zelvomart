import { apiFetch } from "@/lib/api";
import { STATIC_PAGES } from "@/lib/dummy-content";

export type CmsPageData = {
  title: string;
  bodyHtml: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export async function getCmsPage(slug: string, fallbackSlugs: string[] = []): Promise<CmsPageData | null> {
  const query = fallbackSlugs.length ? `?fallback=${encodeURIComponent(fallbackSlugs.join(","))}` : "";
  try {
    return await apiFetch<CmsPageData>(`/api/pages/${encodeURIComponent(slug)}${query}`, {
      next: { revalidate: 600, tags: ["pages", `page:${slug}`] },
    });
  } catch {
    const fallback = STATIC_PAGES[slug] || fallbackSlugs.map((candidate) => STATIC_PAGES[candidate]).find(Boolean);
    return fallback || null;
  }
}

// Use this for pages where placeholder/static content must never appear publicly.
export async function getCmsPageStrict(slug: string, fallbackSlugs: string[] = []): Promise<CmsPageData | null> {
  const query = fallbackSlugs.length ? `?fallback=${encodeURIComponent(fallbackSlugs.join(","))}` : "";
  try {
    return await apiFetch<CmsPageData>(`/api/pages/${encodeURIComponent(slug)}${query}`, {
      next: { revalidate: 300, tags: ["pages", `page:${slug}`] },
    });
  } catch {
    return null;
  }
}
