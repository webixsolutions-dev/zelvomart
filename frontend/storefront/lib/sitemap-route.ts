import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { loadSeoIndex } from "./backend";
import { sitemapResponse } from "./sitemaps";

/** GET handler body for one published sitemap file (see sitemaps.ts). */
export function serveSitemap(file: string) {
  return sitemapResponse(file, loadSeoIndex, async (error) => {
    unstable_rethrow(error); // Next's own "this route is dynamic" signal must reach Next
    await connection();
  });
}
