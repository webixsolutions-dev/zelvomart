import type { Metadata } from "next";
import DbPage from "@/components/DbPage";
import { metadataForPage } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage('terms', ['terms-conditions']);
}

export default function Page() {
  return <DbPage slug='terms' fallbackSlugs={['terms-conditions']} />;
}
