import { serveSitemap } from "@store/lib/sitemap-route";

export const revalidate = 3600;

export function GET() {
  return serveSitemap("page-sitemap.xml");
}
