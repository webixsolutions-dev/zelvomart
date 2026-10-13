const BADGE_BY_TAG: Record<string, string> = {
  "customer-favourite": "Customer favourite",
  "best-selling": "Best selling",
  "new-arrival": "New arrival",
  "15-off": "15% off",
  "20-off": "20% off",
  "30-off": "30% off",
};

export function productBadges(catalog: Record<string, unknown> | null | undefined) {
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
    }
  }

  return labels.slice(0, 3);
}
