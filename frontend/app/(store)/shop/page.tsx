import { ShopListing, shopMetadata } from "@store/components/shop/ArchiveRoutes";

export const revalidate = 300;

export function generateMetadata() {
  return shopMetadata();
}

export default function Page() {
  return <ShopListing />;
}
