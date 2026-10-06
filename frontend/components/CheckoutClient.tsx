"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearPersistedCart, useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { trackStoreEvent, readCookie } from "@/lib/client-tracking";
import { getReplaySessionId, requestReplayFlush } from "@/lib/session-replay-client";

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

const empty: Fields = {
  fullName: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  postcode: "",
  orderNotes: "",
  terms: false,
  website: "",
};

function parseJsonCookie(name: string) {
  const raw = readCookie(name);
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function normalizedPhone(value: string) {
  return value.replace(/\D/g, "");
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
  const { items, subtotal, bundleSaving, ready, clear, setOpen } = useCart();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState("");
  const [serverError, setServerError] = useState("");
  const [restored, setRestored] = useState(false);
  const abandonTimer = useRef<number | null>(null);
  const checkoutTracked = useRef(false);

  const deliveryFee = useMemo(() => {
    if (delivery.mode === "FLAT") return Number(delivery.flatRate || 0);
    if (delivery.mode === "FREE_ABOVE") return subtotal >= Number(delivery.freeAbove || 0) ? 0 : Number(delivery.flatRate || 0);
    return 0;
  }, [delivery, subtotal]);
  const codFee = Number(delivery.codFee || 0);
  const total = subtotal + deliveryFee + codFee;

  useEffect(() => {
    setOpen(false);
    let nextFields = empty;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) nextFields = { ...empty, ...JSON.parse(saved) };
      if (!sessionStorage.getItem(IDEMPOTENCY_KEY)) sessionStorage.setItem(IDEMPOTENCY_KEY, crypto.randomUUID());
    } catch {}
    setFields(nextFields);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(fields)); } catch {}
  }, [fields, restored]);

  useEffect(() => {
    if (!ready || !items.length || checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackStoreEvent("InitiateCheckout", {
      content_ids: items.map((item) => item.sku || item.productId),
      contents: items.map((item) => ({ id: item.sku || item.productId, quantity: item.quantity * item.bundleSize, item_price: item.price })),
      num_items: items.reduce((sum, item) => sum + item.quantity * item.bundleSize, 0),
      value: total,
      currency: "PKR",
    }, { clarityEvent: "begin_checkout" }).catch(() => undefined);
    try { window.clarity?.("upgrade", "checkout"); } catch {}
  }, [items, ready, total]);

  useEffect(() => {
    if (!ready || !items.length || normalizedPhone(fields.phone).length < 10) return;
    if (abandonTimer.current) window.clearTimeout(abandonTimer.current);
    abandonTimer.current = window.setTimeout(() => {
      fetch("/api/store-proxy/api/checkout/abandoned", {
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
    }, 1600);
    return () => { if (abandonTimer.current) window.clearTimeout(abandonTimer.current); };
  }, [fields.phone, fields.fullName, fields.email, fields.city, fields.address, items, ready]);

  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  };

  const validateAll = () => {
    const next: Record<string, string> = {};
    if (fields.fullName.trim().length < 2) next.fullName = "Full name is required.";
    if (normalizedPhone(fields.phone).length < 10) next.phone = "Enter a valid phone number.";
    if (required.email && !fields.email.trim()) next.email = "Email is required.";
    if (fields.email && !/^\S+@\S+\.\S+$/.test(fields.email.trim())) next.email = "Enter a valid email.";
    if (!fields.city.trim()) next.city = "City is required.";
    if (fields.address.trim().length < 6) next.address = "Complete delivery address is required.";
    if (required.postcode && !fields.postcode.trim()) next.postcode = "Postcode is required.";
    if (fields.postcode && fields.postcode.trim().length < 3) next.postcode = "Enter a valid postcode.";
    if (required.orderNotes && !fields.orderNotes.trim()) next.orderNotes = "Order notes are required.";
    if (required.terms && !fields.terms) next.terms = "Please accept the terms.";
    setErrors(next);
    Object.keys(next).forEach((field) => { try { window.clarity?.("event", `checkout_error_${field}`); } catch {} });
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document.querySelector<HTMLElement>(`[data-checkout-field="${first}"] input, [data-checkout-field="${first}"] textarea`)?.focus();
    }
    return !Object.keys(next).length;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !items.length || submitting || redirecting || !validateAll()) return;
    setSubmitting(true);
    setServerError("");
    requestReplayFlush();
    try {
      try { window.clarity?.("event", "place_order_tap"); } catch {}
      const idempotencyKey = sessionStorage.getItem(IDEMPOTENCY_KEY) || crypto.randomUUID();
      sessionStorage.setItem(IDEMPOTENCY_KEY, idempotencyKey);

      const response = await fetch("/api/store-proxy/api/orders", {
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
          experiments: parseJsonCookie("zm_experiments"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not place order");

      try { window.clarity?.("event", "order_placed"); window.clarity?.("identify", data.orderNumber); } catch {}
      setConfirmedOrder(String(data.orderNumber || ""));
      setRedirecting(true);
      requestReplayFlush();
      setOpen(false);
      clearPersistedCart();
      clear();
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      const successUrl = `/checkout/success/${encodeURIComponent(data.orderNumber)}?key=${encodeURIComponent(data.id)}`;
      window.dispatchEvent(new Event("zelvo:route-start"));
      router.replace(successUrl, { scroll: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message.replace(/_/g, " ") : "Could not place order");
      setSubmitting(false);
    }
  };

  if (!ready || !restored) {
    return <div className="mock-checkout-loading" aria-live="polite"><span /><b>Loading your secure checkout…</b></div>;
  }

  if (redirecting) {
    return <div className="mock-checkout-redirect mock-checkout-confirming" aria-live="polite">
      <span className="mock-confirm-success">✓</span>
      <h2>Order confirmed{confirmedOrder ? ` · #${confirmedOrder}` : ""}</h2>
      <p>Opening your confirmation page…</p>
      <div className="mock-confirm-route-loader"><i /><i /><i /></div>
    </div>;
  }

  if (!items.length) {
    return <div className="content-card text-center"><h2>Your cart is empty</h2><p>Add a product before checking out.</p><a href="/shop" className="btn-primary mt-4">Shop products</a></div>;
  }

  const selectedCity = cities.find((city) => city.name.toLowerCase() === fields.city.trim().toLowerCase());

  return (
    <>
      {submitting ? <div className="mock-order-processing-overlay" role="status" aria-live="polite">
        <div className="mock-order-processing-card">
          <div className="mock-order-orbit" aria-hidden="true"><i /><i /><b>✓</b></div>
          <span className="mock-order-processing-kicker">SECURE CHECKOUT</span>
          <h2>Confirming your order…</h2>
          <p>Please stay on this page for a moment. We’re reserving your items and creating your confirmation.</p>
          <div className="mock-order-processing-progress"><i /></div>
          <small>Cash on Delivery · No payment is being charged online</small>
        </div>
      </div> : null}

      <form className="mock-checkout-layout mock-single-checkout" onSubmit={submit}>
        <section className="mock-checkout-form">
          <div className="mock-checkout-section">
            <div className="mock-checkout-section-title"><b>1</b><div><h2>Contact information</h2><p>We’ll use these details for your order confirmation.</p></div></div>
            <div className="mock-checkout-fields">
              <div className="field" data-checkout-field="fullName">
                <label htmlFor="checkout-full-name">Full name *</label>
                <input id="checkout-full-name" data-clarity-mask="true" autoComplete="name" placeholder="Your full name" value={fields.fullName} onChange={(e) => update("fullName", e.target.value)} />
                {errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}
              </div>
              <div className="field" data-checkout-field="phone">
                <label htmlFor="checkout-phone">Phone number *</label>
                <input id="checkout-phone" data-clarity-mask="true" autoComplete="tel" inputMode="tel" placeholder="03XX-XXXXXXX" value={fields.phone} onChange={(e) => update("phone", e.target.value)} />
                {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
              </div>
              <div className="field full" data-checkout-field="email">
                <label htmlFor="checkout-email">Email address {required.email ? "*" : "(optional)"}</label>
                <input id="checkout-email" data-clarity-mask="true" autoComplete="email" type="email" placeholder="you@example.com" value={fields.email} onChange={(e) => update("email", e.target.value)} />
                {errors.email ? <span className="field-error">{errors.email}</span> : null}
              </div>
            </div>
          </div>

          <div className="mock-checkout-section">
            <div className="mock-checkout-section-title"><b>2</b><div><h2>Delivery details</h2><p>Enter the address where you want to receive your parcel.</p></div></div>
            <div className="mock-checkout-fields">
              <div className="field" data-checkout-field="city">
                <label htmlFor="checkout-city">City *</label>
                <input id="checkout-city" list="pakistan-cities" autoComplete="address-level2" placeholder="Search your city" value={fields.city} onChange={(e) => update("city", e.target.value)} />
                <datalist id="pakistan-cities">{cities.map((city) => <option key={city.name} value={city.name} />)}</datalist>
                {selectedCity ? <small className="mock-step-success">✓ Estimated delivery: {selectedCity.deliveryMinDays}–{selectedCity.deliveryMaxDays} working days</small> : null}
                {errors.city ? <span className="field-error">{errors.city}</span> : null}
              </div>
              <div className="field" data-checkout-field="postcode">
                <label htmlFor="checkout-postcode">Postcode {required.postcode ? "*" : "(optional)"}</label>
                <input id="checkout-postcode" data-clarity-mask="true" autoComplete="postal-code" inputMode="numeric" placeholder="e.g. 54000" value={fields.postcode} onChange={(e) => update("postcode", e.target.value)} />
                {errors.postcode ? <span className="field-error">{errors.postcode}</span> : null}
              </div>
              <div className="field full" data-checkout-field="address">
                <label htmlFor="checkout-address">Full delivery address *</label>
                <textarea id="checkout-address" data-clarity-mask="true" autoComplete="street-address" rows={4} placeholder="House / flat, street, area, nearby landmark…" value={fields.address} onChange={(e) => update("address", e.target.value)} />
                {errors.address ? <span className="field-error">{errors.address}</span> : null}
              </div>
              <div className="field full" data-checkout-field="orderNotes">
                <label htmlFor="checkout-notes">Order notes {required.orderNotes ? "*" : "(optional)"}</label>
                <textarea id="checkout-notes" rows={3} placeholder="Landmark, preferred call time, delivery note…" value={fields.orderNotes} onChange={(e) => update("orderNotes", e.target.value)} />
                {errors.orderNotes ? <span className="field-error">{errors.orderNotes}</span> : null}
              </div>
            </div>
          </div>

          <div className="mock-checkout-section">
            <div className="mock-checkout-section-title"><b>3</b><div><h2>Payment</h2><p>Pay when your parcel reaches you.</p></div></div>
            <label className="mock-delivery-choice">
              <input type="radio" checked readOnly />
              <span><b>Cash on Delivery</b><small>Pay cash when your parcel arrives.</small></span>
              <strong>COD</strong>
            </label>
            <label className="mock-checkout-terms" data-checkout-field="terms">
              <input type="checkbox" checked={fields.terms} onChange={(e) => update("terms", e.target.checked)} />
              <span>I agree to the terms and confirm my delivery details are correct.</span>
            </label>
            {errors.terms ? <span className="field-error">{errors.terms}</span> : null}

            <div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => update("website", e.target.value)} /></div>
            {serverError ? <div className="mock-checkout-error">{serverError}</div> : null}
            <button type="submit" className="mock-place-order mock-single-place-order" disabled={submitting || (required.terms && !fields.terms)}>
              {submitting ? <><span className="mock-order-button-spinner" /> Confirming…</> : `Place order · ${money(total)} →`}
            </button>
          </div>
        </section>

        <aside className="mock-checkout-summary">
          <h2>Your order</h2>
          {items.map((item) => <div className="mock-checkout-line" key={`${item.productId}-${item.variantId || "base"}-${item.bundleSize}`}><span>{item.name}<small>Qty {item.quantity * item.bundleSize}</small></span><b>{money(item.price * item.quantity * item.bundleSize * (item.bundleSize === 2 ? 1 - (item.bundleDiscountPercent || 5) / 100 : 1))}</b></div>)}
          <hr />
          <div><span>Items</span><b>{money(subtotal)}</b></div>
          {bundleSaving > 0 ? <div className="saving"><span>Bundle saving</span><b>-{money(bundleSaving)}</b></div> : null}
          <div><span>Delivery</span><b>{deliveryFee ? money(deliveryFee) : "Free"}</b></div>
          {codFee ? <div><span>COD fee</span><b>{money(codFee)}</b></div> : null}
          <div className="total"><span>Total</span><b>{money(total)}</b></div>
          <div className="mock-pay-arrival">✓ Pay cash when your parcel arrives</div>
          <button type="submit" className="mock-place-order" disabled={submitting || (required.terms && !fields.terms)}>{submitting ? <><span className="mock-order-button-spinner" /> Confirming…</> : "Place order →"}</button>
          <p className="mock-order-help">Need help? Call <b>0300-2026711</b> or message us on WhatsApp.</p>
        </aside>
      </form>
    </>
  );
}
