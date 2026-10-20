import { categories, collections, products, type CategoryId, type CollectionKey } from "@store/lib/catalog";
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
          <ArchiveView ids={items.map((p) => p.id)} />
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
        breadcrumbs={[{ label: "Shop", href: "/shop-all-products/" }, { label: c.name }]}
        eyebrow="Shop by category"
        title={c.name}
        sub={c.intro}
      />
      <section className="section pt-sm">
        <div className="container">
          <ArchiveView ids={items.map((p) => p.id)} heading={`Shop ${c.name}`} lockedCategory={id} />
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
