const BADGE_BY_TAG: Record<string, string> = {
  "customer-favourite": "Customer favourite",
  "best-selling": "Best selling",
  "new-arrival": "New arrival",
  "15-off": "15% off",
  "20-off": "20% off",
  "30-off": "30% off",
};

export function badgesFromCatalog(input: {
  badge?: string | null;
  badges?: string[] | null;
  tags?: string[] | null;
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
  return labels.slice(0, 3);
}
