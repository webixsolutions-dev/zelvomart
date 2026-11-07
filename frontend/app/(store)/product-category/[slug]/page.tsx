import { categories } from "@store/lib/catalog";
import { CategoryListing, categoryMetadata } from "@store/components/shop/ArchiveRoutes";

export const revalidate = 300;

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return categoryMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <CategoryListing slug={(await params).slug} />;
}
