import { getProductById } from "./catalog";

/**
 * Product reviews. Only approved reviews are ever shown or put into schema: they come with the
 * product from the backend (GET /api/products/slug/:slug returns approved reviews only).
 * Customer submissions go to the backend and require a delivered order.
 */

export type ReviewMedia = { type: "image" | "video"; url: string };
export type Review = {
  id: string;
  productId: string;
  name: string;
  city?: string;
  rating: number;
  text: string;
  createdAt: string;
  verified?: boolean;
  media?: ReviewMedia[];
  avatarUrl?: string;
};

export function approvedReviews(productId: string): Review[] {
  return [...(getProductById(productId)?.reviews || [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function reviewSummary(list: Review[]) {
  const count = list.length;
  const average = count ? list.reduce((s, r) => s + r.rating, 0) / count : 0;
  const bars = [5, 4, 3, 2, 1].map((star) => ({ star, count: list.filter((r) => Math.round(r.rating) === star).length }));
  return { count, average, bars };
}

/** Email updates: saved with the time consent was given; sending is handled by the backend later. */
export function saveSubscriber(email: string) {
  try {
    const key = "zlv-subscribers";
    const all = JSON.parse(localStorage.getItem(key) || "[]");
    all.push({ email, consentAt: new Date().toISOString(), source: "review" });
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
