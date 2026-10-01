import type { Metadata } from "next";
import DbPage from "@/components/DbPage";
import { metadataForPage } from "@/lib/page-metadata";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage('about-us', []);
}

export default function Page() {
  return <DbPage slug='about-us' fallbackSlugs={[]} />;
}
