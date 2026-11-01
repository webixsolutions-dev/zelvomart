import Link from "next/link";
import { categories, categoryPath, collections, type CategoryId, type CollectionKey, type Product } from "@store/lib/catalog";
import type { ArchiveParams } from "@store/lib/archive";
import type { CardPage } from "@store/lib/backend";
import { site } from "@store/lib/site";
import { waLink } from "@store/lib/format";
import { ProductGrid } from "@store/components/product/ProductGrid";
import { SectionHead } from "@store/components/ui/SectionHead";
import { Hero } from "@store/components/home/Hero";
import { WhatsAppBand } from "@store/components/home/Blocks";
import { ArchiveView } from "./ArchiveView";
import { CollectionAbout } from "./CollectionAbout";

/** A collection page (shop, new arrivals, bestsellers, deals): one page of 24, loaded by the route. */
export function CollectionArchive({ k, data, params, basePath }: { k: CollectionKey; data: CardPage; params: ArchiveParams; basePath: string }) {
  const c = collections[k];
  return (
    <>
      <Hero size="short" priority desktop={c.banner} mobile={c.bannerMobile} mobileImageFull breadcrumbs={[{ label: c.title }]} eyebrow={c.eyebrow} title={c.title} sub={c.sub} />
      <section className="section pt-sm">
        <div className="container">
          <ArchiveView items={data.items} total={data.total} totalPages={data.totalPages} params={params} basePath={basePath} name={c.title} />
          <CollectionAbout name={c.title} text={c.sub} />
        </div>
      </section>
      <section className="section pt-0">
        <div className="container">
          <WhatsAppBand />
        </div>
      </section>
    </>
  );
}

/**
 * A category page: one page of 24 (loaded by the route). `soon` is set when the category has no published products
 * at all: then the "coming soon" block shows instead of the grid.
 */
export function CategoryArchive({
  id,
  data,
  params,
  basePath,
  soon,
}: {
  id: CategoryId;
  data: CardPage;
  params: ArchiveParams;
  basePath: string;
  soon?: { others: CategoryId[]; picks: Product[] } | null;
}) {
  const c = categories.find((x) => x.id === id)!;
  return (
    <>
      <Hero
        size="short"
        priority
        desktop={c.banner}
        mobile={c.bannerMobile}
        breadcrumbs={[{ label: "Shop", href: "/shop/" }, { label: c.name }]}
        eyebrow="Shop by category"
        title={c.name}
        sub={c.intro}
      />
      <section className="section pt-sm">
        <div className="container">
          {soon ? (
            <CategoryComingSoon id={id} others={soon.others} picks={soon.picks} />
          ) : (
            <ArchiveView
              items={data.items}
              total={data.total}
              totalPages={data.totalPages}
              params={params}
              basePath={basePath}
              heading={`Shop ${c.name}`}
              lockedCategory={id}
            />
          )}
          <CollectionAbout name={c.name} text={c.about} />
        </div>
      </section>
      <section className="section pt-0">
        <div className="container">
          <WhatsAppBand />
        </div>
      </section>
    </>
  );
}

/**
 * A category with no published products yet: still a useful, indexable page (owner decision, 30 Oct 2026).
 * No empty grid: a "coming soon" note with WhatsApp, the other categories and a row of bestsellers.
 */
function CategoryComingSoon({ id, others: otherIds, picks }: { id: CategoryId; others: CategoryId[]; picks: Product[] }) {
  const c = categories.find((x) => x.id === id)!;
  const others = categories.filter((x) => otherIds.includes(x.id));
  return (
    <>
      <div className="category-soon">
        <h2>New {c.name} products are coming soon</h2>
        <p>
          We are adding new products to {c.name}. Looking for something specific? Message us on WhatsApp and we will help
          you find it.
        </p>
        <a
          className="btn wa"
          href={waLink(site.whatsappNumber, `Hi Zelvomart! I'm looking for ${c.name} products.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ask on WhatsApp
        </a>
        {others.length > 0 && (
          <nav aria-label="Other categories" className="category-soon-links">
            <h3>Browse other categories</h3>
            <div className="chips center">
              {others.map((o) => (
                <Link key={o.id} href={categoryPath(o.id)}>
                  {o.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
      {picks.length > 0 && (
        <div className="category-soon-picks">
          <SectionHead eyebrow="Popular right now" title="Bestsellers" href="/bestsellers/" />
          <ProductGrid items={picks} />
        </div>
      )}
    </>
  );
}
