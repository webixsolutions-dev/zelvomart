import type { PolicyDocument, PolicyIcon, PolicySection, PolicySlug } from "./types";

/**
 * The policy text lives in the files in this folder and changes only in code. Until
 * backend/prisma/sql/03-drop-cms-pages.sql is run, a policy row still in the Page table (saved in the old
 * Admin → Pages) is shown instead: each <h2> starts one section card, the text under it becomes the card's
 * paragraphs (links kept, every other tag dropped). With the table empty, the file version always shows.
 */

/** Date the file versions of the policies last changed; shown as "Last updated". */
export const POLICY_FILES_UPDATED = "2026-10-21";

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

/** HTML → plain paragraphs with Markdown links (the only markup PolicyLayout renders). */
function htmlToBody(html: string) {
  const withLinks = html.replace(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_, _q, href: string, text: string) => {
    const label = decode(text.replace(/<[^>]+>/g, "")).trim();
    return label ? `[${label.replace(/[[\]]/g, "")}](${decode(href).replace(/[()\s]/g, "")})` : "";
  });
  return decode(
    withLinks
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n\n")
      .replace(/<\/(p|li|ul|ol|h[3-6]|div|blockquote)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Icons and tones for headings the file versions don't have, so new sections still look designed. */
const KEYWORD_ICONS: [RegExp, PolicyIcon][] = [
  [/privacy|personal|information we collect/i, "shield"],
  [/contact|message|email/i, "mail"],
  [/security|secure|protect/i, "lock"],
  [/record|video|replay/i, "video"],
  [/cookie|pixel|analytic|data/i, "database"],
  [/review|rating/i, "message"],
  [/shar|third/i, "share"],
  [/right|choice|delete/i, "user"],
  [/change|update/i, "refresh"],
  [/deliver|ship|courier/i, "truck"],
  [/return|refund|exchange/i, "return"],
  [/pay|cash|price/i, "cash"],
  [/order/i, "package"],
  [/time|day|hour/i, "clock"],
  [/law|legal|govern/i, "scale"],
];

function styleFor(heading: string, fallback: PolicyDocument): Pick<PolicySection, "icon" | "tone" | "half"> {
  const known = fallback.sections.find((s) => s.heading.trim().toLowerCase() === heading.trim().toLowerCase());
  if (known) return { icon: known.icon, ...(known.tone ? { tone: known.tone } : {}), ...(known.half ? { half: known.half } : {}) };
  const hit = KEYWORD_ICONS.find(([re]) => re.test(heading));
  return { icon: hit ? hit[1] : "document" };
}

export type PageRow = { title?: string; bodyHtml?: string | null; seoDescription?: string | null; updatedAt?: string; published?: boolean };

/**
 * A saved Page row as the design's policy document, or null when it has no <h2> sections
 * (for example the one-line placeholder an older seed created): the file version shows then.
 */
export function pageToPolicy(slug: PolicySlug, page: PageRow | null, fallback: PolicyDocument): PolicyDocument | null {
  const html = String(page?.bodyHtml || "");
  const parts = html.split(/<h2\b[^>]*>/i).slice(1);
  const sections: PolicySection[] = [];
  for (const part of parts) {
    const end = part.search(/<\/h2>/i);
    if (end < 0) continue;
    const heading = decode(part.slice(0, end).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const body = htmlToBody(part.slice(end + 5));
    if (!heading || !body) continue;
    sections.push({ heading, body, ...styleFor(heading, fallback) });
  }
  if (!sections.length) return null;
  return {
    slug,
    title: page?.title?.trim() || fallback.title,
    subtitle: page?.seoDescription?.trim() || fallback.subtitle,
    icon: fallback.icon,
    sections,
    updatedAt: page?.updatedAt,
  };
}
