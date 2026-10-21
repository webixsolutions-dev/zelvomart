import type { Metadata } from "next";
import { shareMeta } from "@store/lib/seo";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, MessageCircleQuestion, PackageSearch, RefreshCw } from "lucide-react";
import { site } from "@store/lib/site";
import { waLink } from "@store/lib/format";
import { loadSettings } from "@store/lib/backend";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { FaqAccordion, FaqJsonLd } from "@store/components/ui/FaqAccordion";
import { FacebookIcon, InstagramIcon, LinkedinIcon, PinterestIcon, TiktokIcon, WhatsAppIcon, XIcon, YoutubeIcon } from "@store/components/ui/BrandIcons";
import { ContactForm, TopicLink } from "@store/components/pages/ContactForm";
import s from "@store/components/pages/Contact.module.css";

export async function generateMetadata(): Promise<Metadata> {
  await loadSettings();
  const description = `Contact Zelvomart on WhatsApp at ${site.phoneDisplay} or by email. Ask about products, orders or delivery; our Lahore team replies 7 days a week.`;
  return {
    title: { absolute: "Contact Zelvomart: WhatsApp, Phone & Email" },
    description,
    alternates: { canonical: "/contact-us/" },
    ...shareMeta({ title: "Contact Zelvomart: WhatsApp, Phone & Email", description, path: "/contact-us/" }),
  };
}

const socials = [
  { label: "Facebook", href: site.social.facebook, Icon: FacebookIcon },
  { label: "Instagram", href: site.social.instagram, Icon: InstagramIcon },
  { label: "TikTok", href: site.social.tiktok, Icon: TiktokIcon },
  { label: "YouTube", href: site.social.youtube, Icon: YoutubeIcon },
  { label: "Pinterest", href: site.social.pinterest, Icon: PinterestIcon },
  { label: "LinkedIn", href: site.social.linkedin, Icon: LinkedinIcon },
  { label: "X", href: site.social.x, Icon: XIcon },
];

/** Questions about getting in touch. A function, so the phone, email and hours from Admin → Settings show. */
function contactFaqs() {
  return [
    {
      q: "What’s the fastest way to reach you?",
      a: `WhatsApp is quickest. Message us on ${site.phoneDisplay} any time, day or night, and we usually reply within a few hours. You can also use the form on this page or email ${site.email}.`,
    },
    {
      q: "What should I include in my message?",
      a: "Your order number (it starts with ZM-), the mobile number you ordered with, and a short description. If it’s about an item you received, add a photo or a short video; it helps us sort it out faster.",
    },
    {
      q: "Can I change my order after placing it?",
      a: "Yes, if it hasn’t been dispatched yet. Message us with your order number and the change you need, and we’ll update it before it leaves.",
    },
    {
      q: "Do you reply on weekends and holidays?",
      a: "Yes. We’re available 24/7, so you can message us any day and we’ll get back to you.",
    },
    {
      q: "I sent the form. When will I hear back?",
      a: "We reply to the email address you entered, usually within a few hours. If it’s urgent, send us a WhatsApp message as well.",
    },
    {
      q: "How can I share feedback about Zelvomart?",
      a: "We’d love to hear it. Leave us a review on Google, or message us directly if something could have gone better.",
    },
  ];
}

/** The Google "G", in its four colours. */
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.45a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.18 3.57-8.73z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.95 11.95 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

export default async function Page() {
  await loadSettings();
  const wa = waLink(site.whatsappNumber, "Hi Zelvomart! I have a question.");
  const faqItems = contactFaqs();
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
              <Clock size={16} /> <span>{site.supportHours}</span> · Replies usually within a few hours
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
            <p className={s.value}>{site.supportHours}</p>
            <p>We reply every day, including weekends and holidays, usually within a few hours.</p>
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
              <span className={`${s.channelTag} ${s.mailTag}`}>
                <Mail size={15} /> Via email
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
            <FaqAccordion items={faqItems} />
            <p className={s.emailReminder}>
              <Mail size={18} aria-hidden="true" />
              <span>
                A longer question?
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </span>
            </p>
          </aside>
        </div>
        <FaqJsonLd items={faqItems} />
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
              <ul className={s.googleLinks}>
                <li>
                  <a href={site.google.listing} target="_blank" rel="noopener noreferrer">
                    <GoogleIcon /> Find us on Google
                  </a>
                </li>
                <li>
                  <a href={site.google.review} target="_blank" rel="noopener noreferrer">
                    <GoogleIcon /> Review us on Google
                  </a>
                </li>
              </ul>
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
