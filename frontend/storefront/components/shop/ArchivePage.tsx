import Link from "next/link";
import { categories, categoryPath, collections, products, type CategoryId, type CollectionKey } from "@store/lib/catalog";
import { site } from "@store/lib/site";
import { waLink } from "@store/lib/format";
import { ProductGrid } from "@store/components/product/ProductGrid";
import { SectionHead } from "@store/components/ui/SectionHead";
import { Hero } from "@store/components/home/Hero";
import { WhatsAppBand } from "@store/components/home/Blocks";
import { ArchiveView } from "./ArchiveView";
import { CollectionAbout } from "./CollectionAbout";

export function CollectionArchive({ k }: { k: CollectionKey }) {
  const c = collections[k];
  const items = products.filter(c.filter);
  return (
    <>
      <Hero size="short" priority desktop={c.banner} mobile={c.bannerMobile} mobileImageFull breadcrumbs={[{ label: c.title }]} eyebrow={c.eyebrow} title={c.title} sub={c.sub} />
      <section className="section pt-sm">
        <div className="container">
          <ArchiveView ids={items.map((p) => p.id)} name={c.title} />
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

export function CategoryArchive({ id }: { id: CategoryId }) {
  const c = categories.find((x) => x.id === id)!;
  const items = products.filter((p) => p.category === id);
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
          {items.length ? (
            <ArchiveView ids={items.map((p) => p.id)} heading={`Shop ${c.name}`} lockedCategory={id} />
          ) : (
            <CategoryComingSoon id={id} />
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
function CategoryComingSoon({ id }: { id: CategoryId }) {
  const c = categories.find((x) => x.id === id)!;
  const others = categories.filter((x) => x.id !== id && products.some((p) => p.category === x.id));
  const best = products.filter((p) => p.isBestseller);
  const picks = (best.length ? best : products).slice(0, 4);
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
