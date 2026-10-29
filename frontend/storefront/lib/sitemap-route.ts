import "server-only";
import { connection } from "next/server";
import { loadSeoIndex } from "./backend";
import { sitemapResponse } from "./sitemaps";

/** GET handler body for one published sitemap file (see sitemaps.ts). */
export function serveSitemap(file: string) {
  return sitemapResponse(file, loadSeoIndex, connection);
}
