import { notFound } from "next/navigation";
import { CategoryListing, ShopListing, categoryMetadata, shopMetadata } from "@store/components/shop/ArchiveRoutes";

type Props = {
  params: Promise<{ listing: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { listing } = await params;
  if (listing[0] === "shop" && listing.length === 1) return shopMetadata(await searchParams);
  if (listing[0] === "product-category" && listing.length === 2) return categoryMetadata(listing[1], await searchParams);
  return {};
}

export default async function Page({ params, searchParams }: Props) {
  const { listing } = await params;
  if (listing[0] === "shop" && listing.length === 1) return <ShopListing search={await searchParams} />;
  if (listing[0] === "product-category" && listing.length === 2) return <CategoryListing slug={listing[1]} search={await searchParams} />;
  notFound();
}
