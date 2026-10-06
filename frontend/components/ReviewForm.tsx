"use client";

import { FormEvent, useEffect, useState } from "react";

export default function ReviewForm({ productId }: { productId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch(`/api/store-proxy/api/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, productId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit review");

      setMessage("Thank you. Your review will appear after verification and moderation.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pdp-review-submit">
      <button
        type="button"
        className="pdp-review-trigger"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        <span className="pdp-review-trigger-icon">★</span>
        <span>
          <b>Give a Review</b>
          <small>Share your experience with other shoppers</small>
        </span>
        <i>→</i>
      </button>

      {open ? (
        <div
          className="pdp-review-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
        >
          <section
            className="pdp-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
          >
            <div className="pdp-review-modal-head">
              <div>
                <span className="mock-eyebrow">CUSTOMER REVIEW</span>
                <h3 id="review-modal-title">Share your experience.</h3>
                <p>
                  Reviews are accepted only from delivered Zelvomart orders.
                  We verify your order number and checkout phone before publishing.
                </p>
              </div>
              <button
                type="button"
                className="pdp-review-modal-close"
                aria-label="Close review form"
                onClick={() => !busy && setOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={submit} className="pdp-review-modal-form">
              <div className="pdp-review-form-grid">
                <label className="field">
                  <span>Name</span>
                  <input name="name" required minLength={2} autoFocus />
                </label>

                <label className="field">
                  <span>Rating</span>
                  <select name="rating" defaultValue="5">
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Very poor</option>
                  </select>
                </label>

                <label className="field">
                  <span>Delivered order number</span>
                  <input name="orderNumber" placeholder="ZM-10234" required />
                </label>

                <label className="field">
                  <span>Phone used on order</span>
                  <input name="phone" placeholder="03XX-XXXXXXX" required />
                </label>
              </div>

              <label className="field">
                <span>Review</span>
                <textarea
                  name="body"
                  rows={5}
                  required
                  minLength={5}
                  placeholder="Tell us what you liked about the product, delivery or ordering experience..."
                />
              </label>

              <input
                name="honeypot"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              {message ? (
                <p className="pdp-review-message">{message}</p>
              ) : null}

              <div className="pdp-review-modal-actions">
                <button
                  type="button"
                  className="pdp-review-cancel"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pdp-review-submit-button"
                  disabled={busy}
                >
                  {busy ? "Submitting..." : "Submit review"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
