import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { cleanHtml } from "@/lib/sanitize";

export default async function DbPage({ slug, fallbackSlugs = [] }: { slug: string; fallbackSlugs?: string[] }) {
  let page = await prisma.page.findFirst({ where: { slug, published: true } });
  if (!page && fallbackSlugs.length) page = await prisma.page.findFirst({ where: { slug: { in: fallbackSlugs }, published: true } });
  if (!page) notFound();
  return <div className="site-shell"><div className="page-head"><h1>{page.title}</h1></div><article className="content-card" dangerouslySetInnerHTML={{ __html: cleanHtml(page.bodyHtml) }} /></div>;
}
