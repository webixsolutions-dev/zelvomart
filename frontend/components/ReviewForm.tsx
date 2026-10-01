"use client";

import { FormEvent, useState } from "react";

export default function ReviewForm({ productId }: { productId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`${API_BASE}/api/reviews`, {
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
    <form onSubmit={submit} className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-black text-slate-800">Share a real customer review</h3>
      <p className="text-xs text-slate-500">Add your delivered order number and phone to mark the review as verified.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field"><span>Name</span><input name="name" required minLength={2}/></label>
        <label className="field"><span>Rating</span><select name="rating" defaultValue="5"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Average</option><option value="2">2 - Poor</option><option value="1">1 - Very poor</option></select></label>
        <label className="field"><span>Order number (optional)</span><input name="orderNumber" placeholder="ZM-10234"/></label>
        <label className="field"><span>Phone used on order (optional)</span><input name="phone" placeholder="03XX-XXXXXXX"/></label>
      </div>
      <label className="field"><span>Review</span><textarea name="body" rows={4} required minLength={5}/></label>
      <input name="honeypot" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true"/>
      <button className="btn-dark w-fit" disabled={busy}>{busy ? "Submitting..." : "Submit review"}</button>
      {message ? <p className="text-sm font-semibold text-slate-600">{message}</p> : null}
    </form>
  );
}
