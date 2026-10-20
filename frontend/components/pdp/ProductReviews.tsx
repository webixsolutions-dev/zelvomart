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
  const [filter, setFilter] = useState<"all" | "recent" | "5" | "4">("all");

  const visible = useMemo(() => {
    const rows = [...reviews];
    if (filter === "recent") {
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (filter === "5") return rows.filter((review) => review.rating === 5);
    if (filter === "4") return rows.filter((review) => review.rating === 4);
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
            <strong>{reviews.length ? average.toFixed(1) : "–"}</strong>
            <div>
              <Stars value={average} />
              <p>
                {reviews.length ? `Based on ${reviews.length} verified review${reviews.length === 1 ? "" : "s"}` : "No reviews for this product yet"}
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

          <ReviewForm productId={product.id} />
        </div>

        {/* Review list */}
        <div>
          {reviews.length ? (
            <div className="zpd-filters">
              {([
                ["all", "All"],
                ["recent", "Most recent"],
                ["5", "5 star"],
                ["4", "4 star"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
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
              {visible.map((review: Review) => (
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
                      {review.verified ? <p>Verified order</p> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="zpd-reviews-empty">
              <i>★</i>
              <p>
                {reviews.length ? "No reviews match this filter." : "Reviews from delivered orders for this product will show up here."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
