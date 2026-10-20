import type { Metadata } from "next";
import { shareMeta } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, MessageCircleQuestion, PackageSearch, RefreshCw } from "lucide-react";
import { site } from "@/lib/site";
import { money, waLink } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FaqAccordion, FaqJsonLd } from "@/components/ui/FaqAccordion";
import { FacebookIcon, InstagramIcon, LinkedinIcon, PinterestIcon, TiktokIcon, WhatsAppIcon, XIcon, YoutubeIcon } from "@/components/ui/BrandIcons";
import { ContactForm, TopicLink } from "@/components/pages/ContactForm";
import s from "@/components/pages/Contact.module.css";

export const metadata: Metadata = {
  title: { absolute: "Contact Zelvomart: WhatsApp, Phone & Email" },
  description: `Contact Zelvomart on WhatsApp at ${site.phoneDisplay} or by email. Ask about products, orders or delivery; our Lahore team replies Monday to Saturday.`,
  alternates: { canonical: "/contact-us/" },
  ...shareMeta({ title: "Contact Zelvomart: WhatsApp, Phone & Email", description: `Contact Zelvomart on WhatsApp at ${site.phoneDisplay} or by email. Ask about products, orders or delivery; our Lahore team replies Monday to Saturday.`, path: "/contact-us/" }),
};

const wa = waLink(site.whatsappNumber, "Hi Zelvomart! I have a question.");
/** "Mon–Sat, 10am – 7pm" → "Mon–Sat, 10am–7pm" */
const hours = site.supportHours.replace(/\s+–\s+/g, "–");
const fee = money(site.shipping.flatFee);
const freeOver = money(site.shipping.freeOver);

const socials = [
  { label: "Facebook", href: site.social.facebook, Icon: FacebookIcon },
  { label: "Instagram", href: site.social.instagram, Icon: InstagramIcon },
  { label: "TikTok", href: site.social.tiktok, Icon: TiktokIcon },
  { label: "YouTube", href: site.social.youtube, Icon: YoutubeIcon },
  { label: "Pinterest", href: site.social.pinterest, Icon: PinterestIcon },
  { label: "LinkedIn", href: site.social.linkedin, Icon: LinkedinIcon },
  { label: "X", href: site.social.x, Icon: XIcon },
];

const contactFaqs = [
  {
    q: "Do you offer Cash on Delivery?",
    a: "Yes. Choose Cash on Delivery at checkout and pay the courier in cash when your parcel arrives. Available payment options are shown before you order.",
  },
  {
    q: "When will my order arrive?",
    a: `Delivery takes ${site.shipping.estimate}, depending on your city. Check your order information and our shipping policy, or message us with your order number.`,
  },
  {
    q: "How much does delivery cost?",
    a: `Delivery is ${fee}, and free on orders above ${freeOver}. Your delivery charge is shown at checkout before you place your order.`,
  },
  {
    q: "How can I track my order?",
    a: "Use our Track Order page with your order number and mobile number. If you need help, send us your order number.",
  },
  {
    q: "Can I ask about a product first?",
    a: "Absolutely. Share the product name or link and ask about its size, materials, colour or availability. We’ll help with the details.",
  },
  {
    q: "What if an item needs attention?",
    a: "Contact us with your order number and a description of the issue. Photos can help us understand it. See the Returns & Refunds policy for the applicable process.",
  },
];

export default function Page() {
  return (
    <>
      {/* ── Hero ── */}
      <section className={s.hero} aria-labelledby="contact-title">
        <Breadcrumbs items={[{ label: "Contact Us" }]} />
        <div className={`container ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <p className="eyebrow">
              <span className={s.line} aria-hidden="true" />
              We’re here for your everyday
            </p>
            <h1 id="contact-title">
              Contact Zelvomart. <span>Real people, real answers.</span>
            </h1>
            <p className={s.heroLead}>
              A product question, an order update, or a little help after delivery. Let’s make the next step easy.
            </p>
            <div className={s.heroActions}>
              <a className="btn wa lg" href={wa} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={19} /> Chat on WhatsApp
              </a>
              <a className={s.formLink} href="#contact-form">
                Or share a few details <ArrowRight size={16} />
              </a>
            </div>
            <p className={s.heroHours}>
              <Clock size={16} /> <span>{hours}</span> · Pakistan time
            </p>
          </div>
          <div className={s.heroArt}>
            <img
              src="/images/contact/contact-hero-760.webp"
              srcSet="/images/contact/contact-hero-760.webp 760w, /images/contact/contact-hero-1280.webp 1280w"
              sizes="(max-width: 760px) 100vw, 640px"
              alt="A powder-blue telephone, a cream envelope and a location pin on a warm, minimal desk"
              width={1280}
              height={853}
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      </section>

      {/* ── Three ways to reach us, as plain text ── */}
      <section className={s.cards} aria-label="Ways to reach Zelvomart">
        <div className={`container ${s.cardGrid}`}>
          <article className={`${s.card} ${s.waCard}`}>
            <div className={s.cardTop}>
              <span className={`${s.channelIcon} ${s.green}`} aria-hidden="true">
                <WhatsAppIcon size={24} />
              </span>
              <span className={s.channelLabel}>A conversation, made easy</span>
            </div>
            <h2>Let’s chat.</h2>
            <a className={s.value} href={wa} target="_blank" rel="noopener noreferrer">
              {site.phoneDisplay}
            </a>
            <p>Ask about a product or get help with an order. A real person is a message away.</p>
            <a className={`${s.cardLink} ${s.greenText}`} href={wa} target="_blank" rel="noopener noreferrer">
              Start a conversation <ArrowRight size={16} />
            </a>
          </article>
          <article className={s.card}>
            <div className={s.cardTop}>
              <span className={s.channelIcon} aria-hidden="true">
                <Mail size={22} />
              </span>
              <span className={s.channelLabel}>A little more detail?</span>
            </div>
            <h2>Write to us.</h2>
            <a className={s.value} href={`mailto:${site.email}`}>
              {site.email}
            </a>
            <p>Send your question, product link or order details. We’ll help with the next step.</p>
            <a className={s.cardLink} href={`mailto:${site.email}`}>
              Write an email <ArrowRight size={16} />
            </a>
          </article>
          <article className={s.card}>
            <div className={s.cardTop}>
              <span className={s.channelIcon} aria-hidden="true">
                <Clock size={22} />
              </span>
              <span className={s.channelLabel}>When we’re here</span>
            </div>
            <h2>Support hours.</h2>
            <p className={s.value}>{hours}</p>
            <p>Pakistan Standard Time. Messages outside these hours are picked up during our next support day.</p>
            <span className={s.hoursTag}>
              <span aria-hidden="true" /> Pakistan time · UTC+5
            </span>
          </article>
        </div>
      </section>

      {/* ── Quick help ── */}
      <section className={s.quick} aria-labelledby="quick-title">
        <div className={`container ${s.quickGrid}`}>
          <div className={s.quickCopy}>
            <p className="eyebrow">A quicker way to the right answer</p>
            <h2 id="quick-title">
              What can we
              <br />
              help you with?
            </h2>
            <p>Choose a starting point. We’ll take it from there.</p>
            <div className={s.topics}>
              <Link className={s.topic} href="/track-your-order/">
                <span className={s.topicIcon} aria-hidden="true">
                  <PackageSearch size={22} />
                </span>
                <span>
                  <strong>Where’s my order?</strong>
                  <small>Head straight to order tracking.</small>
                </span>
                <ArrowRight size={18} className={s.topicArrow} />
              </Link>
              <TopicLink className={s.topic} topic="Returns & exchanges">
                <span className={s.topicIcon} aria-hidden="true">
                  <RefreshCw size={21} />
                </span>
                <span>
                  <strong>Help with an order</strong>
                  <small>Returns, exchanges or an item query.</small>
                </span>
                <ArrowRight size={18} className={s.topicArrow} />
              </TopicLink>
              <TopicLink className={s.topic} topic="Product question">
                <span className={s.topicIcon} aria-hidden="true">
                  <MessageCircleQuestion size={22} />
                </span>
                <span>
                  <strong>A product on your mind?</strong>
                  <small>Ask about size, details or availability.</small>
                </span>
                <ArrowRight size={18} className={s.topicArrow} />
              </TopicLink>
            </div>
          </div>
          <figure className={s.care}>
            <img
              src="/images/about/packing-care-720.webp"
              srcSet="/images/about/packing-care-720.webp 720w, /images/about/packing-care-1200.webp 1200w"
              sizes="(max-width: 760px) 100vw, 560px"
              alt="An everyday find being carefully wrapped in a parcel"
              width={1200}
              height={800}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              A little care.
              <strong>With every order, and every question.</strong>
            </figcaption>
            <span className={s.stamp} aria-hidden="true">
              From our stock.
              <strong>With care.</strong>
            </span>
          </figure>
        </div>
      </section>

      {/* ── Form + FAQ ── */}
      <section className={s.workspace} aria-label="Send us a message">
        <div className={`container ${s.workspaceGrid}`}>
          <div className={s.message} id="contact-form">
            <div className={s.messageTop}>
              <p className="eyebrow">Let’s get started</p>
              <span className={s.channelTag}>
                <WhatsAppIcon size={15} /> Via WhatsApp
              </span>
            </div>
            <h2>
              Start with
              <br />a few details.
            </h2>
            <p className={s.formIntro}>Tell us what you need, and we’ll help you find the next step.</p>
            <ContactForm />
          </div>

          <aside className={s.faq} aria-labelledby="faq-title">
            <p className="eyebrow">A little clarity, right here</p>
            <h2 id="faq-title">
              Good questions.
              <br />
              Useful answers.
            </h2>
            <p className={s.faqLead}>A few things you may want to know before getting in touch.</p>
            <FaqAccordion items={contactFaqs} />
            <p className={s.emailReminder}>
              <Mail size={18} aria-hidden="true" />
              <span>
                A longer question?
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </span>
            </p>
          </aside>
        </div>
        <FaqJsonLd items={contactFaqs} />
      </section>

      {/* ── Home base (last section) ── */}
      <section className={`${s.location} ${s.last}`} aria-labelledby="location-title">
        <div className={`container ${s.locationGrid}`}>
          <div className={s.identity}>
            <span className={s.locationSymbol} aria-hidden="true">
              <MapPin size={26} />
            </span>
            <div>
              <p className="eyebrow">Our home base</p>
              <h2 id="location-title">Lahore, Pakistan.</h2>
              <p>An online store for everyday life, delivering across Pakistan.</p>
            </div>
          </div>
          <div className={s.social}>
            <p>Find a little everyday inspiration.</p>
            <ul>
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Zelvomart on ${label}`}>
                    <Icon size={19} />
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
