import { permanentRedirect, redirect, notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { loadStore } from "@store/lib/backend";

export const revalidate = 600;

/**
 * Any URL no other route serves. There are no CMS pages any more, so this never renders content: it applies
 * an Admin redirect the proxy's map has not picked up yet (the map refreshes every 2 minutes), otherwise it
 * shows the store's own 404 page with its header and footer. Without this route, Next.js would answer
 * unknown URLs with its plain built-in 404, because the store and the admin each have their own root layout.
 */
export default async function UnknownUrl({ params }: { params: Promise<{ slug: string[] }> }) {
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
  await loadStore();
  notFound();
}
