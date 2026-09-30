import type { Metadata } from "next";
import DbPage from "@/components/DbPage";
import { metadataForPage } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage('privacy-policy', []);
}

export default function Page() {
  return <DbPage slug='privacy-policy' fallbackSlugs={[]} />;
}
