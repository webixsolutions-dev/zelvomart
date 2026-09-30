import type { Metadata } from "next";
import DbPage from "@/components/DbPage";
import { metadataForPage } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage('contact-us', []);
}

export default function Page() {
  return <DbPage slug='contact-us' fallbackSlugs={[]} />;
}
