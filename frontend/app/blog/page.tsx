import type { Metadata } from "next";
import DbPage from "@/components/DbPage";
import { metadataForPage } from "@/lib/page-metadata";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage("blog", []);
}

export default function BlogPage() {
  return <DbPage slug="blog" fallbackSlugs={[]} />;
}
