import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { site } from "@/lib/launch/site";

export type Crumb = { label: string; href?: string };

/** `inHero` renders the trail as a frosted pill inside a hero's copy instead of as its own row. */
export function Breadcrumbs({ items, inHero = false }: { items: Crumb[]; inHero?: boolean }) {
  const all: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: site.url + c.href } : {}),
    })),
  };
  return (
    <nav className={inHero ? "breadcrumb breadcrumb-hero" : "container breadcrumb"} aria-label="Breadcrumb">
      <ol>
        {all.map((c, i) => (
          <li key={i}>
            {c.href && i < all.length - 1 ? <Link prefetch={false} href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            {i < all.length - 1 && <ChevronRight size={13} aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}
