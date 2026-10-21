import type { Metadata } from "next";
import { shareMeta } from "@store/lib/seo";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Check,
  CircleCheck,
  HeartHandshake,
  Layers,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { categories, categoryPath, type CategoryId } from "@store/lib/catalog";
import { site } from "@store/lib/site";
import { loadSettings } from "@store/lib/backend";
import { waLink } from "@store/lib/format";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { FaqAccordion, FaqJsonLd } from "@store/components/ui/FaqAccordion";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";
import s from "@store/components/pages/About.module.css";

export const metadata: Metadata = {
  title: { absolute: "About Zelvomart: Online Store in Lahore, Pakistan" },
  description:
    "Zelvomart is a Lahore-based online store selling everyday products in seven categories. Every order is checked before dispatch and sent across Pakistan.",
  alternates: { canonical: "/about-us/" },
  ...shareMeta({ title: "About Zelvomart: Online Store in Lahore, Pakistan", description: "Zelvomart is a Lahore-based online store selling everyday products in seven categories. Every order is checked before dispatch and sent across Pakistan.", path: "/about-us/" }),
};

const started = new Date(`${site.foundingDate}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const cat = (id: CategoryId) => categories.find((c) => c.id === id)!;

const trust = [
  { icon: Banknote, title: "Cash on Delivery", sub: "Pay when it arrives" },
  { icon: ShieldCheck, title: "Checked with care", sub: "Before every dispatch" },
  { icon: Truck, title: "Across Pakistan", sub: "From our stock to your door" },
  { icon: HeartHandshake, title: "A real person to help", sub: "Just a WhatsApp away" },
];

/**
 * Everything on this page that reads the store settings (phone, hours, delivery days). A function,
 * called after `loadSettings()`, so Admin → Settings values show instead of the defaults.
 */
function settingsContent() {
/** "Zelvomart at a glance": short, quotable facts, all read from the store settings and catalogue. */
const glance: [string, string, boolean?][] = [
  ["Name", site.name],
  ["Based in", site.city],
  ["What we sell", `Everyday products in seven categories: ${categories.map((c) => c.name).join(", ")}`, true],
  ["How to order", `zelvomart.com, WhatsApp ${site.phoneDisplay}, Facebook Messenger or Instagram`, true],
  ["Delivery", `Across Pakistan, in ${site.shipping.estimate} depending on the city`],
  ["Support", `WhatsApp and email, ${site.supportHours}`, true],
  ["Started", started],
  ["Co-founder", site.founder],
];

/** The four ordering steps used on the home page. */
const steps = [
  { title: "Order Placed", sub: "Choose your product and confirm your order." },
  { title: "Confirmation", sub: "We reach out on WhatsApp or call to confirm your address." },
  { title: "Dispatched", sub: "Packed and handed to our courier within 24–48 hours." },
  { title: "Delivered", sub: `Arrives in ${site.shipping.estimate}.` },
];

const promises = [
  { title: "Know what you’re choosing.", sub: "Clear descriptions and useful product details, so you can choose with confidence." },
  { title: "Know what you’re paying.", sub: "Review your order total at checkout, before you place your order." },
  { title: "Know who to ask.", sub: "A real conversation on WhatsApp, before and after your order." },
];

const aboutFaqs = [
  {
    q: "Where do you deliver?",
    a: `We deliver across Pakistan, usually in ${site.shipping.estimate} depending on your city. Delivery charges are shown at checkout, and the shipping policy has the details.`,
  },
  {
    q: "How can I track my order?",
    a: "Visit our Track Order page with your order number and mobile number. You can also contact us on WhatsApp for help.",
  },
  {
    q: "Can you help me choose a product?",
    a: "Of course. Share the product link and your question on WhatsApp. We’ll help with the details so you can decide.",
  },
  {
    q: "What if I need help after delivery?",
    a: "Message us with your order number and we’ll guide you. You can also read our Returns & Refunds policy before ordering.",
  },
];

const wa = waLink(site.whatsappNumber, "Hi Zelvomart! I have a question.");
return { glance, steps, promises, aboutFaqs, wa };
}

const gridOrder: CategoryId[] = ["home-living", "home-decor", "beauty", "tech", "fashion", "fitness", "kids"];

export default async function Page() {
  await loadSettings();
  const { glance, steps, promises, aboutFaqs, wa } = settingsContent();
  const featured = cat("home-living");
  return (
    <>
      {/* ── Hero ── */}
      <section className={s.hero} aria-labelledby="about-title">
        <Breadcrumbs items={[{ label: "About Us" }]} />
        <div className={`container ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <p className="eyebrow">
              <span className={s.line} aria-hidden="true" />
              Hello, we’re Zelvomart
            </p>
            <h1 id="about-title">
              About Zelvomart. <span>Everyday things, chosen with care.</span>
            </h1>
            <p className={s.heroLead}>For the home you’re making, the moments you’re sharing, and the little things in between.</p>
            <p className={s.heroDetail}>Thoughtfully selected finds across seven categories, delivered across Pakistan.</p>
            <div className={s.heroButtons}>
              <Link className="btn lg" href="/shop/">
                Explore our world <ArrowRight size={17} />
              </Link>
              <a className={`btn lg ghost ${s.talk}`} href={wa} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={17} /> Talk to us
              </a>
            </div>
            <p className={s.heroNote}>
              <MapPin size={15} /> From Lahore, for your everyday.
            </p>
          </div>

          <div className={s.mosaic}>
            <div className={s.mosaicMain}>
              <img src={featured.tile} alt="Warm, everyday home and living essentials" width={640} height={640} fetchPriority="high" decoding="async" />
              <span className={s.mosaicLabel}>
                <span aria-hidden="true" /> Little finds. Everyday joy.
              </span>
            </div>
            <div className={s.mosaicSide}>
              <img src={cat("beauty").tile} alt="Beauty and personal care essentials" width={640} height={640} decoding="async" />
              <img src={cat("kids").tile} alt="Playful toys and thoughtful finds for little ones" width={640} height={640} decoding="async" />
            </div>
            <span className={s.mosaicBadge}>
              <Sparkles size={22} aria-hidden="true" />
              <span>
                Chosen for
                <strong>real life.</strong>
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Trust row ── */}
      <div className={s.trust}>
        <ul className={`container ${s.trustGrid}`}>
          {trust.map((t) => (
            <li key={t.title}>
              <span className={s.trustIcon}>
                <t.icon size={22} />
              </span>
              <span>
                <strong>{t.title}</strong>
                <small>{t.sub}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Our story ── */}
      <section className={s.story} aria-labelledby="story-title">
        <div className={`container ${s.storyGrid}`}>
          <figure className={s.storyVisual}>
            <img
              src="/images/about/packing-care-720.webp"
              srcSet="/images/about/packing-care-720.webp 720w, /images/about/packing-care-1200.webp 1200w"
              sizes="(max-width: 760px) 100vw, 640px"
              alt="A parcel being carefully wrapped in tissue, beside everyday essentials"
              width={1200}
              height={800}
              loading="lazy"
              decoding="async"
            />
            <figcaption className={s.storyNote}>
              <span className={s.noteIcon} aria-hidden="true">
                <PackageCheck size={20} />
              </span>
              <span>
                Good things deserve
                <strong>a little extra care.</strong>
              </span>
            </figcaption>
          </figure>
          <div className={s.storyCopy}>
            <p className="eyebrow">Our story</p>
            <h2 id="story-title">
              From a simple idea
              <br />
              to a store you can count on.
            </h2>
            <p>
              Zelvomart started with a simple idea: shopping online in Pakistan shouldn’t feel like a gamble. Too many people have been
              let down by products that look nothing like the photos, vague listings, and sellers who go quiet once the parcel ships. We
              set out to build the opposite: a store where what you see is what arrives at your door.
            </p>
            <p>
              We’re based in Lahore, and we run Zelvomart the way we’d want to be treated as customers ourselves: real photos of our own
              stock, honest descriptions, every order checked before dispatch, and a real person on WhatsApp whenever you need help.
            </p>
            <p>
              We started small, with a handful of categories we could genuinely stand behind. As we grow, we add new categories based on
              what our customers actually ask for: not just what’s trending, but what people across Pakistan really need for their homes,
              their families and their everyday lives.
            </p>
            <div className={s.signature}>
              <span className={s.signatureMark} aria-hidden="true">
                Z.
              </span>
              <span>
                Useful finds. Personal service.
                <strong>That’s the Zelvomart way.</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── At a glance ── */}
      <section className={s.glanceSection} aria-labelledby="glance-title">
        <div className={`container ${s.glance}`}>
          <div className={s.glanceHead}>
            <p className="eyebrow">The short version</p>
            <h2 id="glance-title">Zelvomart at a glance</h2>
            <p>The facts in one place, for anyone getting to know us.</p>
          </div>
          <dl className={s.glanceList}>
            {glance.map(([k, v, wide]) => (
              <div key={k} className={wide ? s.wide : undefined}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Seven categories ── */}
      <section className={s.collections} aria-labelledby="collections-title">
        <div className="container">
          <div className={s.sectionHead}>
            <div>
              <p className="eyebrow">Seven categories. One thoughtful store.</p>
              <h2 id="collections-title">
                For the many sides
                <br />
                of your everyday.
              </h2>
            </div>
            <p>From a calmer corner at home to a little moment of play. Find something that fits your life.</p>
          </div>
          <div className={s.collectionGrid}>
            {gridOrder.map((id) => {
              const c = cat(id);
              const isFeatured = id === "home-living";
              return (
                <Link className={`${s.collection} ${isFeatured ? s.featured : ""}`} href={categoryPath(id)} key={id}>
                  {isFeatured ? (
                    <img src={c.tile} alt="" width={640} height={640} loading="lazy" decoding="async" />
                  ) : (
                    <img
                      src={c.image}
                      srcSet={`${c.image.replace("-600.webp", "-400.webp")} 400w, ${c.image} 600w`}
                      sizes="(max-width: 760px) 50vw, 300px"
                      alt=""
                      width={600}
                      height={450}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span className={s.collectionCopy}>
                    {isFeatured && <span className={s.kicker}>Make yourself at home</span>}
                    <strong>{c.name}</strong>
                    {isFeatured && <span className={s.collectionDesc}>Small comforts. Better routines.</span>}
                  </span>
                  <span className={s.roundArrow} aria-hidden="true">
                    <ArrowUpRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
          <div className={s.collectionFoot}>
            <span>A little something for every part of your day.</span>
            <Link className={s.textLink} href="/shop/">
              Shop all products <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── From our stock to your doorstep ── */}
      <section className={s.process} aria-labelledby="process-title">
        <div className="container">
          <div className={s.sectionHead}>
            <div>
              <p className="eyebrow">Care, at every step</p>
              <h2 id="process-title">
                From our stock
                <br />
                <span>to your doorstep.</span>
              </h2>
            </div>
            <p>A simple journey, with clear details and someone to help along the way.</p>
          </div>
          <div className={s.processGrid}>
            <figure className={s.processPhoto}>
              <img
                src="/images/about/packing-desk-640.webp"
                srcSet="/images/about/packing-desk-640.webp 640w, /images/about/packing-desk-1100.webp 1100w"
                sizes="(max-width: 760px) 100vw, 640px"
                alt="A Zelvomart parcel being prepared for dispatch"
                width={1100}
                height={587}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                <CircleCheck size={20} aria-hidden="true" /> Selected. Checked. Packed with care.
              </figcaption>
            </figure>
            <ol className={s.steps}>
              {steps.map((st, i) => (
                <li key={st.title}>
                  <span className={s.stepNumber}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{st.title}</h3>
                    <p>{st.sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Trust is in the little details ── */}
      <section className={s.confidence} aria-labelledby="confidence-title">
        <div className={`container ${s.confidenceGrid}`}>
          <div className={s.confidenceCopy}>
            <p className="eyebrow">The Zelvomart promise</p>
            <h2 id="confidence-title">
              Trust is in
              <br />
              the little details.
            </h2>
            <p>We want you to feel good about your order, from the first look to the moment it arrives.</p>
            <Link className={s.lightLink} href="/shop/">
              Find your next everyday favourite <ArrowRight size={16} />
            </Link>
          </div>
          <ul className={s.promiseList}>
            {promises.map((p) => (
              <li key={p.title}>
                <span aria-hidden="true">
                  <Check size={17} strokeWidth={2.6} />
                </span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.sub}</p>
                </div>
              </li>
            ))}
          </ul>
          <figure className={s.confidenceImage}>
            <img src={cat("fashion").tile} alt="Carefully styled fashion accessories" width={640} height={640} loading="lazy" decoding="async" />
            <figcaption>
              Thoughtful finds.
              <strong>From us to you.</strong>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Good to know ── */}
      <section className={s.faq} aria-labelledby="faq-title">
        <div className={`container ${s.faqGrid}`}>
          <div className={s.faqIntro}>
            <p className="eyebrow">A little more about us</p>
            <h2 id="faq-title">
              Good to know.
              <br />
              Easy to ask.
            </h2>
            <p>A few answers before your first order.</p>
            <ul className={s.facts}>
              <li>
                <MapPin size={18} /> Based in {site.city}
              </li>
              <li>
                <Layers size={18} /> Seven everyday categories
              </li>
              <li>
                <WhatsAppIcon size={18} /> Personal WhatsApp support
              </li>
            </ul>
            <a className={s.textLink} href={wa} target="_blank" rel="noopener noreferrer">
              Have another question? Let’s talk <ArrowRight size={16} />
            </a>
          </div>
          <div>
            <FaqAccordion items={aboutFaqs} />
          </div>
        </div>
        <FaqJsonLd items={aboutFaqs} />
      </section>

      {/* ── WhatsApp call to action (last section) ── */}
      <section className={`${s.band} ${s.last}`} aria-labelledby="band-title">
        <div className={`container ${s.bandInner}`}>
          <div>
            <p className="eyebrow">Always a person. Always happy to help.</p>
            <h2 id="band-title">A question, a find, a little advice?</h2>
            <p>Let’s make your next order feel easy.</p>
          </div>
          <a className={`btn lg ${s.bandButton}`} href={wa} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon size={18} /> Chat on WhatsApp
          </a>
        </div>
      </section>
    </>
  );
}
