"use client";

import { useMemo, useState } from "react";
import ReviewForm from "@/components/ReviewForm";
import type { Product, Review } from "@/types/product";
import { Stars } from "./pdp-icons";

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "Z";
}

export default function ProductReviews({ product }: { product: Product }) {
  const reviews = product.reviews || [];
  const [filter, setFilter] = useState<"all" | "media" | "recent">("all");
  const [shown, setShown] = useState(3);
  const [writing, setWriting] = useState(false);
  const hasMedia = (review: Review) => Array.isArray((review as Review & { images?: unknown[] }).images) && ((review as Review & { images?: unknown[] }).images?.length ?? 0) > 0;

  const visible = useMemo(() => {
    const rows = [...reviews];
    if (filter === "recent") {
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (filter === "media") return rows.filter(hasMedia);
    return rows;
  }, [reviews, filter]);

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;
  const counts = [5, 4, 3, 2, 1].map((star) => reviews.filter((review) => review.rating === star).length);

  return (
    <section id="reviews" className="zpd-reviews">
      <div className="zpd-reviews-head">
        <div>
          <span className="zpd-eyebrow">Reviews</span>
          <h2 className="zpd-h2">What customers say.</h2>
        </div>
        <span className="zpd-verified">Verified orders only</span>
      </div>

      <div className="zpd-reviews-grid">
        {/* Score card */}
        <div className="zpd-score">
          <div className="zpd-score-top">
            <strong>{reviews.length ? average.toFixed(1) : "0"}</strong>
            <div>
              <Stars value={reviews.length ? average : 5} />
              <p>
                {reviews.length ? `Based on ${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "No reviews yet"}
              </p>
            </div>
          </div>

          <div className="zpd-bars">
            {counts.map((count, index) => {
              const star = 5 - index;
              const width = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
              return (
                <div className={`zpd-bar${count ? "" : " is-empty"}`} key={star}>
                  <span>{star} star</span>
                  <i>
                    <u style={{ width: `${width}%` }} />
                  </i>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>

          <button type="button" className="zpd-cta zpd-write-review" onClick={() => setWriting(true)}>
            Write a review
          </button>
        </div>

        {/* Review list */}
        <div>
          {reviews.length ? (
            <div className="zpd-filters">
              {([
                ["all", "All"],
                ["media", "With photos & videos"],
                ["recent", "Most recent"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => (setFilter(id), setShown(3))}
                  className={`zpd-filter${filter === id ? " is-active" : ""}`}
                  aria-pressed={filter === id}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {visible.length ? (
            <div className="zpd-review-list">
              {visible.slice(0, shown).map((review: Review) => (
                <article key={review.id} className="zpd-review">
                  <div className="zpd-review-top">
                    <Stars value={review.rating} />
                    <time>{formatReviewDate(review.createdAt)}</time>
                  </div>
                  <p className="zpd-review-body">{review.body}</p>
                  <div className="zpd-review-author">
                    <span className="zpd-avatar">{initials(review.name)}</span>
                    <div>
                      <h3>{review.name}</h3>
                      {review.verified ? <p>✓ Verified buyer</p> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="zpd-reviews-empty">
              <Stars value={5} />
              <span>(0)</span>
              <p>{reviews.length ? "No reviews match this filter." : "No reviews yet. Be the first to share your experience."}</p>
            </div>
          )}
          {visible.length > shown ? (
            <button type="button" className="zpd-pill-btn zpd-load-more" onClick={() => setShown((n) => n + 10)}>
              See all reviews →
            </button>
          ) : null}
        </div>
      </div>

      {/* Write a review: centred on desktop, bottom sheet on phones. The form posts to /api/reviews (approved in Admin → Reviews). */}
      {writing ? (
        <div className="zpd-review-modal" role="dialog" aria-modal="true" aria-label="Write a review" onClick={(e) => e.target === e.currentTarget && setWriting(false)}>
          <div className="zpd-review-sheet">
            <button type="button" className="zpd-review-close" aria-label="Close" onClick={() => setWriting(false)}>
              ×
            </button>
            <div className="zpd-review-product">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image} alt="" />
              ) : null}
              <strong>{product.name}</strong>
            </div>
            <ReviewForm productId={product.id} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
