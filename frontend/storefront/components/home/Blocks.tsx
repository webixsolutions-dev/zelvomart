import Link from "next/link";
import { ArrowRight, Banknote, ClipboardCheck, MousePointerClick, PackageCheck, ShieldCheck, Tag, Truck } from "lucide-react";
import { categories, type CategoryId, categoryPath } from "@/lib/catalog";
import { site } from "@/lib/site";
import { waLink } from "@/lib/format";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";

export function TrustStrip() {
  const items = [
    { icon: <Banknote size={22} />, title: "Cash on Delivery", sub: "Pay when your parcel arrives" },
    { icon: <ShieldCheck size={22} />, title: "Checked Before Dispatch", sub: "Every item inspected & packed" },
    { icon: <WhatsAppIcon size={21} />, title: "Real WhatsApp Support", sub: "Ask anything before you buy" },
    { icon: <Tag size={22} />, title: "Affordable Prices", sub: "Premium quality, budget friendly" },
  ];
  return (
    <div className="trust-strip" role="list">
      {items.map((t) => (
        <div className="trust-item" role="listitem" key={t.title}>
          <span className="trust-icon">{t.icon}</span>
          <span>
            <strong>{t.title}</strong>
            <small>{t.sub}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

/** `short` replaces `desc` on homepage phones, where the `line` is hidden. */
const categoryCards: { id: CategoryId; line: string; desc: string; short: string }[] = [
  { id: "home-living", line: "Smart tools for everyday", desc: "Practical kitchen, storage and cleaning helpers that make daily routines easier.", short: "Kitchen, storage & cleaning helpers." },
  { id: "beauty", line: "Look good, feel confident", desc: "Skincare, makeup and self-care tools for a simple everyday routine.", short: "Skincare, makeup & self-care tools." },
  { id: "tech", line: "Everyday tech, made easy", desc: "Smart watches, earbuds and handy gadgets for work, travel and play.", short: "Watches, earbuds & handy gadgets." },
  { id: "kids", line: "Fun that keeps them busy", desc: "Creative, screen-free toys made for play, learning and imagination.", short: "Creative, screen-free toys." },
  { id: "home-decor", line: "Decorate your happy place", desc: "Lamps, diffusers and cosy accents to make every room feel like home.", short: "Lamps, diffusers & cosy accents." },
  { id: "fashion", line: "Bags, jewelry & more", desc: "Handbags, jewellery and accessories to complete your everyday look.", short: "Bags, jewellery & accessories." },
  { id: "fitness", line: "Gear up, stay active", desc: "Mats, bottles and home workout gear to keep you moving every day.", short: "Mats, bottles & workout gear." },
];

/** Responsive, lazy-loaded image that fills its positioned parent (like next/image `fill`, but with a real srcset). */
function FillImage({ src, srcSet, sizes, alt = "" }: { src: string; srcSet: string; sizes: string; alt?: string }) {
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

export function CategoryGrid() {
  return (
    <div className="category-grid">
      {categoryCards.map((card) => {
        const category = categories.find((c) => c.id === card.id)!;
        return (
          <Link className="category-card" href={categoryPath(category.id)} key={category.id}>
            <span className="category-media">
              <FillImage
                src={category.image}
                srcSet={`${category.image.replace("-600.webp", "-400.webp")} 400w, ${category.image} 600w`}
                sizes={card.id === "fitness" ? "(max-width:760px) 100vw, 320px" : "(max-width:760px) 50vw, 320px"}
              />
            </span>
            <span className="category-shade" aria-hidden="true" />
            <span className="category-copy">
              <strong>{category.name}</strong>
              <small>{card.line}</small>
              <span className="category-desc">
                <span className="category-desc-full">{card.desc}</span>
                <span className="category-desc-short">{card.short}</span>
              </span>
              <span className="btn category-shop">Shop Now</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

const promos = [
  {
    id: "fashion",
    kicker: "Fashion Accessories",
    title: "Style Essentials",
    desc: "Bags, jewellery & accessories to complete your everyday look.",
    cta: "Shop Fashion",
    image: "/upcategory/fashion",
  },
  {
    id: "beauty",
    kicker: "Beauty & Personal Care",
    title: "Beauty Picks",
    desc: "Everyday beauty and self-care essentials for your routine.",
    cta: "Shop Beauty",
    image: "/upcategory/beauty",
  },
  {
    id: "kids",
    kicker: "Kids & Toys",
    title: "Play & Learn",
    desc: "Fun, creative toys made for play, learning and imagination.",
    cta: "Shop Kids",
    image: "/upcategory/kids",
  },
] as const;

export function CollectionCards() {
  return (
    <div className="collection-grid">
      {promos.map((c) => (
        <Link href={categoryPath(c.id)} className="collection-card" key={c.id}>
          <FillImage src={`${c.image}-900.webp`} srcSet={`${c.image}-600.webp 600w, ${c.image}-900.webp 900w`} sizes="(max-width:760px) 100vw, 420px" />
          <span className="collection-shade" aria-hidden="true" />
          <span className="collection-copy">
            <span className="collection-kicker">{c.kicker}</span>
            <strong>{c.title}</strong>
            <span className="collection-desc">{c.desc}</span>
            <span className="btn collection-shop">
              {c.cta} <ArrowRight size={14} />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ProcessSteps() {
  const steps = [
    { icon: <MousePointerClick size={24} />, title: "Order Placed", sub: "Choose your product and confirm your order." },
    { icon: <ClipboardCheck size={24} />, title: "Confirmation", sub: "We reach out on WhatsApp or call to confirm your address." },
    { icon: <PackageCheck size={24} />, title: "Dispatched", sub: "Packed and handed to our courier within 24–48 hours." },
    { icon: <Truck size={24} />, title: "Delivered", sub: `Arrives in ${site.shipping.estimate}. Pay cash on delivery.` },
  ];
  return (
    <ol className="how-grid">
      {steps.map((s, i) => (
        <li className="how-step" key={s.title}>
          <span className="how-ico">{s.icon}</span>
          <small>Step {String(i + 1).padStart(2, "0")}</small>
          <h3>{s.title}</h3>
          <p>{s.sub}</p>
        </li>
      ))}
    </ol>
  );
}

export function WhatsAppBand({ title = "Chat with us on WhatsApp", sub = "Get product help, order updates or recommendations. We’re here to help!" }: { title?: string; sub?: string }) {
  return (
    <div className="whatsapp-band">
      <span className="wa-bubble">
        <WhatsAppIcon size={28} />
      </span>
      <div>
        <div className="eyebrow">Have a question?</div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
      <a className="btn wa" href={waLink(site.whatsappNumber, "Hi Zelvomart! I have a question.")} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon /> Chat on WhatsApp
      </a>
    </div>
  );
}

export function PageIntro({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="page-intro container">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}
