const BADGE_BY_TAG: Record<string, string> = {
  "customer-favourite": "Customer favourite",
  "best-selling": "Best selling",
  "new-arrival": "New arrival",
};

/** The %-off collection tags. They only show a badge when the product really has a sale price. */
const PERCENT_OFF_TAGS = ["15-off", "20-off", "30-off"];

export function badgesFromCatalog(input: {
  badge?: string | null;
  badges?: string[] | null;
  tags?: string[] | null;
  onSale?: boolean;
  discountPercent?: number;
}) {
  const labels: string[] = [];
  const push = (value?: string | null) => {
    const clean = String(value || "").trim();
    if (!clean) return;
    if (labels.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    labels.push(clean);
  };
  push(input.badge);
  for (const badge of input.badges || []) push(badge);
  for (const tag of input.tags || []) push(BADGE_BY_TAG[tag]);
  // The % shown is worked out from the real sale price, never taken from the tag.
  const percent = Math.round(Number(input.discountPercent || 0));
  if (input.onSale && percent > 0 && (input.tags || []).some((tag) => PERCENT_OFF_TAGS.includes(tag))) push(`${percent}% off`);
  return labels.slice(0, 3);
}
