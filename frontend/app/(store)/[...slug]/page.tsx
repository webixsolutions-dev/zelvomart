import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { loadStore } from "@store/lib/backend";
import { CmsPage } from "@store/components/pages/CmsPage";

export const revalidate = 600;

type CmsRow = { title: string; bodyHtml?: string | null; seoTitle?: string | null; seoDescription?: string | null; published?: boolean };

async function loadPage(slug: string[]) {
  if (slug.length !== 1) return null;
  try {
    return await apiFetch<CmsRow>(`/api/pages/${encodeURIComponent(slug[0])}`, { next: { revalidate: 600, tags: ["pages", `page:${slug[0]}`] } });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.title,
    ...(page.seoDescription ? { description: page.seoDescription } : {}),
    alternates: { canonical: `/${slug[0]}/` },
  };
}

/** Admin redirects that the proxy map has not picked up yet, then CMS pages, then the design's 404. */
export default async function CatchAll({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/${slug.join("/")}/`;
  let row: { destination?: string; permanent?: boolean } | null = null;
  try {
    row = await apiFetch<{ destination?: string; permanent?: boolean }>(`/api/redirects/resolve?path=${encodeURIComponent(path)}`, {
      next: { revalidate: 600, tags: ["redirects"] },
    });
  } catch {
    row = null;
  }
  // Outside the try: redirect() works by throwing, and a catch would swallow it.
  if (row?.destination) {
    if (row.permanent) permanentRedirect(row.destination);
    redirect(row.destination);
  }
  const page = await loadPage(slug);
  if (!page) {
    await loadStore();
    notFound();
  }
  return <CmsPage title={page.title} bodyHtml={page.bodyHtml || ""} />;
}
