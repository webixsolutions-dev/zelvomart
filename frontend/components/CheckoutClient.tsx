"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { trackStoreEvent, readCookie } from "@/lib/client-tracking";
import { API_BASE } from "@/lib/client-api";
import { getReplaySessionId } from "@/lib/session-replay-client";

const SESSION_KEY = "zm_checkout_form";
const IDEMPOTENCY_KEY = "zm_checkout_idempotency";

type Fields = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  postcode: string;
  orderNotes: string;
  terms: boolean;
  website: string;
};

const empty: Fields = { fullName: "", phone: "", email: "", city: "", address: "", postcode: "", orderNotes: "", terms: false, website: "" };

function parseJsonCookie(name: string) {
  const raw = readCookie(name);
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

export default function CheckoutClient({
  cities,
  required,
  delivery,
}: {
  cities: Array<{ name: string; deliveryMinDays: number; deliveryMaxDays: number }>;
  required: Record<string, boolean>;
  delivery: { mode?: string; flatRate?: number; freeAbove?: number; codFee?: number };
}) {
  const router = useRouter();
  const { items, subtotal, bundleSaving, clear } = useCart();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const abandonTimer = useRef<number | null>(null);

  const deliveryFee = useMemo(() => {
    if (delivery.mode === "FLAT") return Number(delivery.flatRate || 0);
    if (delivery.mode === "FREE_ABOVE") return subtotal >= Number(delivery.freeAbove || 0) ? 0 : Number(delivery.flatRate || 0);
    return 0;
  }, [delivery, subtotal]);
  const codFee = Number(delivery.codFee || 0);
  const total = subtotal + deliveryFee + codFee;

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) setFields({ ...empty, ...JSON.parse(saved) });
      if (!sessionStorage.getItem(IDEMPOTENCY_KEY)) sessionStorage.setItem(IDEMPOTENCY_KEY, crypto.randomUUID());
    } catch {}

    trackStoreEvent("InitiateCheckout", {
      content_ids: items.map((item) => item.variantId || item.productId),
      num_items: items.reduce((sum, item) => sum + item.quantity * item.bundleSize, 0),
      value: subtotal,
      currency: "PKR",
    }, { clarityEvent: "begin_checkout" }).catch(() => undefined);
    try { window.clarity?.("upgrade", "checkout"); } catch {}
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(fields)); } catch {}
  }, [fields]);

  useEffect(() => {
    if (!/^\+?92|^03/.test(fields.phone.replace(/\s/g, ""))) return;
    if (abandonTimer.current) window.clearTimeout(abandonTimer.current);
    abandonTimer.current = window.setTimeout(() => {
      fetch(`${API_BASE}/api/checkout/abandoned`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: fields.phone,
          fullName: fields.fullName,
          email: fields.email,
          city: fields.city,
          address: fields.address,
          cart: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, bundleSize: item.bundleSize })),
          source: { firstTouch: parseJsonCookie("zm_first_touch"), lastTouch: parseJsonCookie("zm_last_touch") },
        }),
      }).catch(() => undefined);
    }, 1100);
    return () => { if (abandonTimer.current) window.clearTimeout(abandonTimer.current); };
  }, [fields.phone, fields.fullName, fields.email, fields.city, fields.address, items]);

  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((current) => ({ ...current, [key]: value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!fields.fullName.trim()) next.fullName = "Full name is required.";
    if (!fields.phone.trim()) next.phone = "Phone is required.";
    if (required.email && !fields.email.trim()) next.email = "Email is required.";
    if (fields.email && !/^\S+@\S+\.\S+$/.test(fields.email)) next.email = "Enter a valid email.";
    if (!fields.city.trim()) next.city = "City is required.";
    if (!fields.address.trim()) next.address = "Address is required.";
    if (required.postcode && !fields.postcode.trim()) next.postcode = "Postcode is required.";
    if (required.terms && !fields.terms) next.terms = "Please accept the terms.";
    setErrors(next);
    Object.keys(next).forEach((field) => { try { window.clarity?.("event", `checkout_error_${field}`); } catch {} });
    return !Object.keys(next).length;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!items.length || submitting || !validate()) return;
    setSubmitting(true);
    setServerError("");
    try {
      await trackStoreEvent("InitiateCheckout", { value: total, currency: "PKR" }, { clarityEvent: "place_order_tap" });
      const idempotencyKey = sessionStorage.getItem(IDEMPOTENCY_KEY) || crypto.randomUUID();
      sessionStorage.setItem(IDEMPOTENCY_KEY, idempotencyKey);

      const response = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          fullName: fields.fullName,
          phone: fields.phone,
          email: fields.email,
          city: fields.city,
          address: fields.address,
          postcode: fields.postcode,
          orderNotes: fields.orderNotes,
          terms: fields.terms,
          paymentMethod: "COD",
          honeypot: fields.website,
          cart: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, bundleSize: item.bundleSize })),
          source: { firstTouch: parseJsonCookie("zm_first_touch"), lastTouch: parseJsonCookie("zm_last_touch"), ...(parseJsonCookie("zm_last_touch") || {}) },
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
          clarityId: readCookie("_clck"),
          replaySessionId: getReplaySessionId(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not place order");

      try { window.clarity?.("event", "order_placed"); window.clarity?.("identify", data.orderNumber); } catch {}
      clear();
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      router.push(`/checkout/success/${encodeURIComponent(data.orderNumber)}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message.replace(/_/g, " ") : "Could not place order");
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) return <div className="content-card text-center"><h2>Your cart is empty</h2><p>Add a product before checking out.</p><a href="/shop" className="btn-primary mt-4">Shop products</a></div>;

  const selectedCity = cities.find((city) => city.name === fields.city);

  return (
    <form className="checkout-layout" onSubmit={submit}>
      <section className="checkout-card">
        <h2>Delivery details</h2>
        <div className="form-grid">
          <div className="field"><label>Full name *</label><input data-clarity-mask="true" value={fields.fullName} onChange={(e) => update("fullName", e.target.value)} />{errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}</div>
          <div className="field"><label>Phone *</label><input data-clarity-mask="true" inputMode="tel" placeholder="03XX-XXXXXXX" value={fields.phone} onChange={(e) => update("phone", e.target.value)} />{errors.phone ? <span className="field-error">{errors.phone}</span> : null}</div>
          <div className="field"><label>Email {required.email ? "*" : ""}</label><input data-clarity-mask="true" type="email" value={fields.email} onChange={(e) => update("email", e.target.value)} />{errors.email ? <span className="field-error">{errors.email}</span> : null}</div>
          <div className="field"><label>City *</label><input list="pakistan-cities" value={fields.city} onChange={(e) => update("city", e.target.value)} /><datalist id="pakistan-cities">{cities.map((city) => <option key={city.name} value={city.name} />)}</datalist>{errors.city ? <span className="field-error">{errors.city}</span> : null}</div>
          <div className="field full"><label>Address *</label><textarea data-clarity-mask="true" rows={3} value={fields.address} onChange={(e) => update("address", e.target.value)} />{errors.address ? <span className="field-error">{errors.address}</span> : null}</div>
          <div className="field"><label>Postcode {required.postcode ? "*" : ""}</label><input data-clarity-mask="true" value={fields.postcode} onChange={(e) => update("postcode", e.target.value)} />{errors.postcode ? <span className="field-error">{errors.postcode}</span> : null}</div>
          <div className="field"><label>Order notes</label><input value={fields.orderNotes} onChange={(e) => update("orderNotes", e.target.value)} /></div>
          <div className="hidden" aria-hidden="true"><label>Website</label><input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => update("website", e.target.value)} /></div>
          <label className="field full flex-row items-start gap-2"><input type="checkbox" checked={fields.terms} onChange={(e) => update("terms", e.target.checked)} className="mt-1 w-auto" /><span className="text-xs text-slate-600">I agree to the terms and confirm the delivery details are correct. {errors.terms ? <b className="field-error ml-1">{errors.terms}</b> : null}</span></label>
        </div>
        {serverError ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{serverError}</div> : null}
      </section>

      <aside className="summary-card">
        <h3>Order summary</h3>
        {items.map((item) => <div className="summary-row" key={`${item.productId}-${item.variantId || "base"}-${item.bundleSize}`}><span>{item.name} × {item.quantity * item.bundleSize}</span><b>{money(item.price * item.quantity * item.bundleSize * (item.bundleSize === 2 ? 1 - (item.bundleDiscountPercent || 5) / 100 : 1))}</b></div>)}
        <div className="summary-row"><span>Items</span><b>{money(subtotal)}</b></div>
        {bundleSaving > 0 ? <div className="summary-row"><span>Bundle saving</span><b className="text-emerald-600">-{money(bundleSaving)}</b></div> : null}
        <div className="summary-row"><span>Delivery</span><b>{deliveryFee ? money(deliveryFee) : "Free"}</b></div>
        {codFee ? <div className="summary-row"><span>COD fee</span><b>{money(codFee)}</b></div> : null}
        <div className="summary-row total"><span>Total</span><span>{money(total)}</span></div>
        <div className="cod-note">Pay cash when your parcel arrives.</div>
        {selectedCity ? <p className="mb-3 text-xs text-slate-500">Estimated delivery: {selectedCity.deliveryMinDays}–{selectedCity.deliveryMaxDays} working days.</p> : null}
        <button className="btn-green w-full" disabled={submitting}>{submitting ? "Placing order..." : "Place Order"}</button>
      </aside>
    </form>
  );
}
