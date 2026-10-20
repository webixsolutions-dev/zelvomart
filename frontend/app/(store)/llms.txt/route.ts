import { categories, categoryPath } from "@/lib/catalog";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/** /llms.txt — a short plain-text summary of Zelvomart for AI assistants, built from the same settings as the site. */
export function GET() {
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
${categories.map((c) => `- [${c.name}](${u(categoryPath(c.id))}): ${c.seoDescription}`).join("\n")}

## Shop
- [All products](${u("/shop-all-products/")})
- [New arrivals](${u("/new-arrivals/")})
- [Bestsellers](${u("/bestsellers/")})
- [Deals & offers](${u("/deals-and-offers/")})

## Policies
- [Shipping policy](${u("/shipping-policy/")})
- [Refund & return policy](${u("/refund-and-return-policy/")})
- [Privacy policy](${u("/privacy-policy/")})
- [Terms & conditions](${u("/terms-and-conditions/")})

## Profiles
${Object.values(site.social).map((s) => `- ${s}`).join("\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
