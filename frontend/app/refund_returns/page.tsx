import type { Metadata } from "next";
import DbPage from "@/components/DbPage";
import { metadataForPage } from "@/lib/page-metadata";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage('refund_returns', ['returns-refunds','returns-exchange']);
}

export default function Page() {
  return <DbPage slug='refund_returns' fallbackSlugs={['returns-refunds','returns-exchange']} />;
}
