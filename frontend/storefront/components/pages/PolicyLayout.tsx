import Link from "next/link";
import { Fragment } from "react";
import {
  Undo2, Heart, Video, CircleCheck, CircleX, MessageCircle, Clock3, Mail,
  Truck, MapPin, PackageCheck, Banknote, FileText, Tags, ClipboardCheck,
  Copyright, Scale, ShieldCheck, Database, Share2, LockKeyhole, UserRound, RefreshCw,
} from "lucide-react";
import { site } from "@store/lib/site";
import { POLICY_FILES_UPDATED } from "@store/lib/policies/html";
import type { PolicyDocument, PolicyIcon, PolicySlug } from "@store/lib/policies/types";
import styles from "./PolicyLayout.module.css";

const icons = {
  return: Undo2, heart: Heart, video: Video, check: CircleCheck, cross: CircleX,
  message: MessageCircle, clock: Clock3, mail: Mail, truck: Truck, pin: MapPin,
  package: PackageCheck, cash: Banknote, document: FileText, tag: Tags,
  clipboard: ClipboardCheck, copyright: Copyright, scale: Scale, shield: ShieldCheck,
  database: Database, share: Share2, lock: LockKeyhole, user: UserRound, refresh: RefreshCw,
} satisfies Record<PolicyIcon, typeof Undo2>;

const navigation: { slug: PolicySlug; label: string; icon: PolicyIcon }[] = [
  { slug: "refund_returns", label: "Refund & Return Policy", icon: "return" },
  { slug: "shipping-policy", label: "Shipping Policy", icon: "truck" },
  { slug: "terms-conditions", label: "Terms & Conditions", icon: "document" },
  { slug: "privacy-policy", label: "Privacy Policy", icon: "shield" },
];

function Icon({ name }: { name: PolicyIcon }) {
  const Symbol = icons[name];
  return <Symbol aria-hidden="true" focusable="false" strokeWidth={1.7} />;
}

function sectionId(index: number) {
  return `policy-section-${index + 1}`;
}

/** Render exact text and literal hrefs without accepting raw HTML. */
function PolicyText({ text }: { text: string }) {
  const links = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(links)) {
    const index = match.index ?? 0;
    parts.push(<Fragment key={`text-${index}`}>{text.slice(cursor, index)}</Fragment>);
    parts.push(<a key={`link-${index}`} href={match[2]}>{match[1]}</a>);
    cursor = index + match[0].length;
  }
  parts.push(<Fragment key="end">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}

export function PolicyLayout({ policy }: { policy: PolicyDocument }) {
  const url = `${site.url}/${policy.slug}/`;
  const updated = new Date(policy.updatedAt || `${POLICY_FILES_UPDATED}T12:00:00+05:00`);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: policy.title,
        description: policy.subtitle,
        inLanguage: "en-PK",
        dateModified: updated.toISOString(),
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site.url },
          { "@type": "ListItem", position: 2, name: policy.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className={styles.page} data-policy={policy.slug}>
      <section className={styles.hero} aria-labelledby="policy-title">
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <span className={styles.heroAccent} aria-hidden="true" />
            <h1 id="policy-title">{policy.title}</h1>
            <p>{policy.subtitle}</p>
            <p className={styles.updated}>
              Last updated: <time dateTime={updated.toISOString().slice(0, 10)}>{updated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" })}</time>
            </p>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <span className={styles.artDisc} />
            <div className={styles.artTile}><Icon name={policy.icon} /></div>
            <span className={styles.artDot} />
            <span className={styles.artPlus}>+</span>
          </div>
        </div>
      </section>

      <div className={styles.tabsShell}>
        <nav className={`container ${styles.tabs}`} aria-label="Store policies">
          {navigation.map((item) => (
            <Link key={item.slug} href={`/${item.slug}/`} aria-current={item.slug === policy.slug ? "page" : undefined}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.body}>
        <div className={`container ${styles.layout}`}>
          <aside className={styles.contents}>
            <nav aria-label={`${policy.title} sections`}>
              {policy.sections.map((section, index) => (
                <a key={section.heading} href={`#${sectionId(index)}`}>{section.heading}</a>
              ))}
            </nav>
          </aside>

          <article className={styles.article} aria-labelledby="policy-title">
            {policy.sections.map((section, index) => (
              <section
                key={section.heading}
                id={sectionId(index)}
                aria-labelledby={`${sectionId(index)}-heading`}
                className={[
                  styles.card,
                  section.half ? styles.half : "",
                  section.tone ? styles[section.tone] : "",
                ].filter(Boolean).join(" ")}
              >
                <div className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}><Icon name={section.icon} /></span>
                  <h2 id={`${sectionId(index)}-heading`}>{section.heading}</h2>
                </div>
                {section.body.split(/\n{2,}/).map((para, i) => (
                  <p key={i}><PolicyText text={para} /></p>
                ))}
              </section>
            ))}
          </article>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </div>
  );
}
