import { notFound, permanentRedirect, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function LegacyRedirectPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const sourcePath = `/${slug.join("/")}/`;
  const row = await prisma.redirect.findUnique({ where: { sourcePath } });
  if (!row) notFound();
  if (row.permanent) permanentRedirect(row.destination);
  redirect(row.destination);
}
