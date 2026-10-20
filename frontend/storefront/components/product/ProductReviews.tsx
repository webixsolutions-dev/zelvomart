"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, ImagePlus, Play, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { reviewSummary, savePendingReview, saveSubscriber, timeAgo, type Review } from "@/lib/reviews";
import { Stars } from "@/components/ui/Stars";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function ReviewCard({ r }: { r: Review }) {
  return (
    <article className="rv-card">
      <header>
        <span className="rv-avatar" aria-hidden="true">
          {initials(r.name)}
        </span>
        <span className="rv-who">
          <strong>{r.name}</strong>
          {r.city && <small>{r.city}</small>}
        </span>
        {r.verified && (
          <span className="rv-verified">
            <BadgeCheck size={15} /> Verified buyer
          </span>
        )}
      </header>
      <div className="rv-meta">
        <Stars rating={r.rating} count={1} size={14} bare className="rv-stars" />
        <small>{timeAgo(r.createdAt)}</small>
      </div>
      <p>{r.text}</p>
      {!!r.media?.length && (
        <div className="rv-media">
          {r.media.map((m) => (
            <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer" aria-label={m.type === "video" ? "Open video" : "Open photo"}>
              {m.type === "video" ? (
                <span className="rv-video">
                  <Play size={18} />
                </span>
              ) : (
                <img src={m.url} alt="" loading="lazy" />
              )}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

type Filter = "all" | "media" | "recent";

export function ProductReviews({ product, reviews }: { product: Product; reviews: Review[] }) {
  const { count, average, bars } = reviewSummary(reviews);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(3);
  const [writing, setWriting] = useState(false);

  const list = useMemo(() => {
    let l = reviews;
    if (filter === "media") l = l.filter((r) => r.media?.length);
    if (filter === "recent") l = [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return l;
  }, [reviews, filter]);

  return (
    <section className="section rv-section" id="reviews" aria-labelledby="reviews-title">
      <div className="container">
        <div className="rv-head">
          <span className="eyebrow">Reviews</span>
          <h2 id="reviews-title">What customers say</h2>
        </div>
        <div className="rv-layout">
          <aside className="rv-summary">
            <strong className="rv-avg">{count ? average.toFixed(1) : "0"}</strong>
            <Stars rating={average} count={count} size={20} showAverage={false} />
            <p>{count ? `Based on ${count} review${count === 1 ? "" : "s"}` : "No reviews yet"}</p>
            <ul className="rv-bars">
              {bars.map((b) => (
                <li key={b.star}>
                  <span>{b.star}★</span>
                  <span className="rv-bar">
                    <span style={{ width: count ? `${(b.count / count) * 100}%` : 0 }} />
                  </span>
                  <span>{b.count}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn block" onClick={() => setWriting(true)}>
              Write a review
            </button>
          </aside>

          <div className="rv-main">
            {count > 0 ? (
              <>
                <div className="rv-filters">
                  <div className="rv-chips" role="group" aria-label="Filter reviews">
                    {(
                      [
                        ["all", "All"],
                        ["media", "With photos & videos"],
                        ["recent", "Most recent"],
                      ] as const
                    ).map(([k, l]) => (
                      <button key={k} type="button" className={filter === k ? "active" : ""} aria-pressed={filter === k} onClick={() => (setFilter(k), setShown(3))}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {list.length > shown && (
                    <button type="button" className="link-btn" onClick={() => setShown(list.length)}>
                      See all →
                    </button>
                  )}
                </div>
                <div className="rv-list">
                  {list.slice(0, shown).map((r) => (
                    <ReviewCard key={r.id} r={r} />
                  ))}
                </div>
                {list.length > shown && (
                  <button type="button" className="btn ghost rv-more" onClick={() => setShown((n) => n + 10)}>
                    See all reviews
                  </button>
                )}
              </>
            ) : (
              <div className="rv-empty">
                <Stars count={0} size={22} />
                <p>No reviews yet. Be the first to share your experience.</p>
                <button type="button" className="btn" onClick={() => setWriting(true)}>
                  Write a review
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {writing && <WriteReviewModal product={product} onClose={() => setWriting(false)} />}
    </section>
  );
}

const MAX_PHOTOS = 5;

function WriteReviewModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ file: File; url: string; type: "image" | "video" }[]>([]);
  const [mediaError, setMediaError] = useState("");
  const [done, setDone] = useState(false);
  const [subEmail, setSubEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  const valid = rating > 0 && name.trim().length > 1 && text.trim().length >= 10;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.body.classList.add("no-scroll");
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("no-scroll");
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setMediaError("");
    const next = [...files];
    for (const file of Array.from(list)) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo) {
        if (next.some((f) => f.type === "video")) {
          setMediaError("You can add one video.");
          continue;
        }
        if (file.type !== "video/mp4" || file.size > 20 * 1024 * 1024) {
          setMediaError("Videos must be MP4, up to 30 seconds and 20 MB.");
          continue;
        }
      } else if (file.type.startsWith("image/")) {
        if (next.filter((f) => f.type === "image").length >= MAX_PHOTOS) {
          setMediaError(`You can add up to ${MAX_PHOTOS} photos.`);
          continue;
        }
      } else continue;
      next.push({ file, url: URL.createObjectURL(file), type: isVideo ? "video" : "image" });
    }
    setFiles(next);
  };

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    savePendingReview({ productId: product.id, name: name.trim(), email: email.trim() || undefined, rating, text: text.trim(), mediaCount: files.length });
    setSubEmail(email.trim());
    setDone(true);
  };

  const first = name.trim().split(/\s+/)[0] ?? "";
  const display = first ? first[0]!.toUpperCase() + first.slice(1) : "";

  return (
    <div className="rv-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rv-modal" role="dialog" aria-modal="true" aria-labelledby="rv-modal-title" tabIndex={-1} ref={dialog}>
        <button type="button" className="rv-close" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
        {!done ? (
          <form onSubmit={publish} noValidate>
            <div className="rv-product">
              <Image src={product.image} alt="" width={56} height={56} />
              <span>
                <small>Write a review</small>
                <strong id="rv-modal-title">{product.name}</strong>
              </span>
            </div>

            <div className="rv-rate" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  className={(hover || rating) >= n ? "on" : ""}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                >
                  <svg viewBox="0 0 20 20" width="34" height="34" aria-hidden="true">
                    <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
                  </svg>
                </button>
              ))}
            </div>

            <div className="rv-fields">
              <label>
                <span>Full name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
              </label>
            </div>
            <label className="rv-text">
              <span className="sr-only">Your review</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your experience with this product" rows={5} required minLength={10} />
              {text.length > 0 && text.trim().length < 10 && <small className="rv-hint">Please write at least 10 characters.</small>}
            </label>

            <div className="rv-upload">
              <label className="rv-add">
                <ImagePlus size={18} /> Add photos &amp; videos
                <input type="file" accept="image/*,video/mp4" multiple onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
              </label>
              <small>Up to 5 photos and 1 video</small>
              {mediaError && <small className="rv-hint">{mediaError}</small>}
              {!!files.length && (
                <div className="rv-previews">
                  {files.map((f, i) => (
                    <span key={f.url}>
                      {f.type === "image" ? <img src={f.url} alt="" /> : <video src={f.url} muted />}
                      <button type="button" aria-label="Remove" onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rv-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={!valid}>
                Publish
              </button>
            </div>
          </form>
        ) : (
          <div className="rv-thanks">
            <span className="rv-avatar lg" aria-hidden="true">
              {display[0] ?? "★"}
            </span>
            <strong>{name.trim()}</strong>
            <h2 id="rv-modal-title">Thank you, {display}!</h2>
            <p>Your review will appear on the page after a quick check.</p>
            <div className="rv-subscribe">
              <strong>Get email updates</strong>
              <p>Get new arrivals and offers by email.</p>
              {subscribed ? (
                <p className="rv-subscribed">You’re subscribed. Thank you!</p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!/^\S+@\S+\.\S+$/.test(subEmail)) return;
                    saveSubscriber(subEmail);
                    setSubscribed(true);
                  }}
                >
                  <input type="email" value={subEmail} onChange={(e) => setSubEmail(e.target.value)} placeholder="Your email" aria-label="Email for updates" />
                  <button type="submit" className="btn secondary">
                    Subscribe
                  </button>
                </form>
              )}
            </div>
            <div className="rv-actions">
              <Link href="/shop-all-products/" className="btn">
                Continue shopping
              </Link>
              <button type="button" className="btn ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
