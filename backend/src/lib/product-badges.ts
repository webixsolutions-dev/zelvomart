const BADGE_BY_TAG: Record<string, string> = {
  "customer-favourite": "Customer favourite",
  "best-selling": "Best selling",
  "new-arrival": "New arrival",
};

/** The %-off collection tags. They only show a badge when the product really has a sale price. */
export const PERCENT_OFF_TAGS = ["15-off", "20-off", "30-off"];

type SaleInfo = { onSale?: boolean; discountPercent?: number } | null | undefined;

export function productBadges(catalog: Record<string, unknown> | null | undefined, sale?: SaleInfo) {
  const labels: string[] = [];
  const push = (value: unknown) => {
    const clean = typeof value === "string" ? value.trim() : "";
    if (!clean) return;
    if (labels.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    labels.push(clean);
  };

  if (catalog) {
    push(catalog.badge);
    if (Array.isArray(catalog.badges)) {
      for (const badge of catalog.badges) push(badge);
    }
    if (Array.isArray(catalog.tags)) {
      for (const tag of catalog.tags) {
        if (typeof tag === "string" && BADGE_BY_TAG[tag]) push(BADGE_BY_TAG[tag]);
      }
      // The % shown is worked out from the real sale price, never taken from the tag.
      const percent = Math.round(Number(sale?.discountPercent || 0));
      if (
        sale?.onSale &&
        percent > 0 &&
        catalog.tags.some((tag) => typeof tag === "string" && PERCENT_OFF_TAGS.includes(tag))
      ) {
        push(`${percent}% off`);
      }
    }
  }

  return labels.slice(0, 3);
}
