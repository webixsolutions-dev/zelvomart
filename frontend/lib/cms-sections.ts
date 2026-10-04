export type CmsSection = {
  id: string;
  title: string;
  bodyHtml: string;
  level: 2 | 3;
};

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function cmsSections(bodyHtml?: string | null): CmsSection[] {
  const html = String(bodyHtml || "").trim();
  if (!html) return [];

  const heading = /<h([23])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;
  const matches = Array.from(html.matchAll(heading));

  if (!matches.length) {
    return [{ id: "section-1", title: "", bodyHtml: html, level: 2 }];
  }

  return matches.map((match, index) => {
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index || html.length) : html.length;
    return {
      id: `section-${index + 1}`,
      title: plainText(match[2]),
      bodyHtml: html.slice(start, end).trim(),
      level: Number(match[1]) === 3 ? 3 : 2,
    };
  });
}
