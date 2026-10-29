import type { MetadataRoute } from "next";
import { site } from "@store/lib/site";

export const dynamic = "force-static";

const privatePaths = ["/cart/", "/checkout/", "/order-confirmed/", "/my-account/", "/wishlist/", "/search/"];

/**
 * Search and AI crawlers are named explicitly so they are never caught by a future blanket rule:
 * ChatGPT search (OAI-SearchBot), OpenAI training (GPTBot, allowed by decision), Perplexity, Claude search, Google and Bing.
 */
const namedBots = ["Googlebot", "Bingbot", "OAI-SearchBot", "GPTBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "ClaudeBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...namedBots.map((userAgent) => ({ userAgent, allow: "/", disallow: privatePaths })),
      { userAgent: "*", allow: "/", disallow: privatePaths },
    ],
    sitemap: `${site.url}/sitemap_index.xml`,
  };
}
