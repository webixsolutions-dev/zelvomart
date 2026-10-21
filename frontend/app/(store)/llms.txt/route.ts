import { categories, categoryPath } from "@store/lib/catalog";
import { site } from "@store/lib/site";
import { loadCategoryIds, loadStoreSettings } from "@store/lib/backend";
import { applyStoreSettings } from "@store/lib/settings";

export const revalidate = 3600;

/** /llms.txt — a short plain-text summary of Zelvomart for AI assistants, built from the same settings as the site. */
export async function GET() {
  // Phone, delivery fees and the category list come from the backend settings.
  const [settings, live] = await Promise.all([loadStoreSettings(), loadCategoryIds()]);
  applyStoreSettings(settings);
  const shown = categories.filter((c) => !live.size || live.has(c.id));
  const u = (path: string) => `${site.url}${path}`;
  const body = `# ${site.name}

> ${site.name} is an online store based in ${site.city}, selling everyday products in seven categories. Every order is checked before dispatch and delivered across Pakistan with Cash on Delivery.

- Based in: ${site.city}
- Payment: Cash on Delivery
- Delivery: across Pakistan, Rs. ${site.shipping.flatFee} per order, free above Rs. ${site.shipping.freeOver.toLocaleString("en-PK")}
- Order online, or on WhatsApp ${site.phoneDisplay}
- Email: ${site.email}
- Support: ${site.supportHours}
- Started: July 2026. Co-founder: ${site.founder}

## About
- [About Zelvomart](${u("/about-us/")})
- [FAQs](${u("/faqs/")})
- [Contact](${u("/contact-us/")})
- [Track an order](${u("/track-your-order/")})

## Categories
${shown.map((c) => `- [${c.name}](${u(categoryPath(c.id))}): ${c.seoDescription}`).join("\n")}

## Shop
- [All products](${u("/shop/")})
- [New arrivals](${u("/new-arrivals/")})
- [Bestsellers](${u("/bestsellers/")})
- [Deals & offers](${u("/deals-and-offers/")})

## Policies
- [Shipping policy](${u("/shipping-policy/")})
- [Refund & return policy](${u("/refund_returns/")})
- [Privacy policy](${u("/privacy-policy/")})
- [Terms & conditions](${u("/terms-conditions/")})

## Profiles
${Object.values(site.social).map((s) => `- ${s}`).join("\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
