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

type Stage = 0 | 1 | 2;

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
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
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
  const { items, subtotal, bundleSaving, ready, clear } = useCart();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState("");
  const [serverError, setServerError] = useState("");
  const [activeStage, setActiveStage] = useState<Stage>(0);
  const [restored, setRestored] = useState(false);
  const abandonTimer = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const checkoutTracked = useRef(false);

  const deliveryFee = useMemo(() => {
    if (delivery.mode === "FLAT") return Number(delivery.flatRate || 0);
    if (delivery.mode === "FREE_ABOVE") return subtotal >= Number(delivery.freeAbove || 0) ? 0 : Number(delivery.flatRate || 0);
    return 0;
  }, [delivery, subtotal]);
  const codFee = Number(delivery.codFee || 0);
  const total = subtotal + deliveryFee + codFee;

  const selectedCity = cities.find((city) => city.name.toLowerCase() === fields.city.trim().toLowerCase());
  const contactReady = fields.fullName.trim().length >= 2
    && /^3\d{9}$/.test(normalizedPhone(fields.phone))
    && (!required.email || /^\S+@\S+\.\S+$/.test(fields.email.trim()));

  useEffect(() => {
    let nextFields = empty;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) nextFields = { ...empty, ...JSON.parse(saved) };
      if (!sessionStorage.getItem(IDEMPOTENCY_KEY)) sessionStorage.setItem(IDEMPOTENCY_KEY, crypto.randomUUID());
    } catch {}
    setFields(nextFields);
    const contactValid = nextFields.fullName.trim().length >= 2 && /^3\d{9}$/.test(normalizedPhone(nextFields.phone)) && (!required.email || /^\S+@\S+\.\S+$/.test(nextFields.email.trim()));
    const deliveryValid = nextFields.city.trim().length >= 2 && nextFields.address.trim().length >= 6 && (!required.postcode || nextFields.postcode.trim().length >= 3) && (!required.orderNotes || nextFields.orderNotes.trim().length >= 2);
    setActiveStage(contactValid ? (deliveryValid ? 2 : 1) : 0);
    setRestored(true);
  }, [required.email, required.orderNotes, required.postcode]);

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
    if (!ready || !items.length || !/^3\d{9}$/.test(normalizedPhone(fields.phone))) return;
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
    }, 1500);
    return () => { if (abandonTimer.current) window.clearTimeout(abandonTimer.current); };
  }, [fields.phone, fields.fullName, fields.email, fields.city, fields.address, items, ready]);

  useEffect(() => {
    if (!restored || activeStage !== 0 || !contactReady || (!required.email && !fields.email.trim())) return;
    const timer = window.setTimeout(() => {
      setActiveStage(1);
      requestReplayFlush();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeStage, contactReady, fields.email, required.email, restored]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const target = stageRef.current?.querySelector<HTMLElement>("input:not([type='hidden']):not([type='checkbox']), textarea");
      target?.focus();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [activeStage]);

  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
    if (serverError) setServerError("");
  };

  const validateContact = () => {
    const next: Record<string, string> = {};
    if (fields.fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!/^3\d{9}$/.test(normalizedPhone(fields.phone))) next.phone = "Enter a valid Pakistani mobile number.";
    if (required.email && !fields.email.trim()) next.email = "Email is required.";
    if (fields.email.trim() && !/^\S+@\S+\.\S+$/.test(fields.email.trim())) next.email = "Enter a valid email address.";
    setErrors((current) => ({ ...current, ...next }));
    return Object.keys(next).length === 0;
  };

  const validateDelivery = () => {
    const next: Record<string, string> = {};
    if (fields.city.trim().length < 2) next.city = "City is required.";
    if (fields.address.trim().length < 6) next.address = "Enter your complete delivery address.";
    if (required.postcode && fields.postcode.trim().length < 3) next.postcode = "Postcode is required.";
    if (fields.postcode.trim() && fields.postcode.trim().length < 3) next.postcode = "Enter a valid postcode.";
    if (required.orderNotes && fields.orderNotes.trim().length < 2) next.orderNotes = "Order notes are required.";
    setErrors((current) => ({ ...current, ...next }));
    return Object.keys(next).length === 0;
  };

  const validateAll = () => {
    const contactOk = validateContact();
    if (!contactOk) { setActiveStage(0); return false; }
    const deliveryOk = validateDelivery();
    if (!deliveryOk) { setActiveStage(1); return false; }
    if (required.terms && !fields.terms) {
      setErrors((current) => ({ ...current, terms: "Please accept the terms." }));
      setActiveStage(2);
      return false;
    }
    return true;
  };

  const continueContact = () => {
    if (!validateContact()) return;
    setActiveStage(1);
    requestReplayFlush();
  };

  const continueDelivery = () => {
    if (!validateDelivery()) return;
    setActiveStage(2);
    requestReplayFlush();
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

      const response = await fetch("/api/checkout-order", {
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
      clearPersistedCart();
      clear();
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      router.replace(`/checkout/success/${encodeURIComponent(data.orderNumber)}`, { scroll: true });
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

  const progress = activeStage === 0 ? 34 : activeStage === 1 ? 67 : 100;

  return (
    <>
      {submitting ? (
        <div className="mock-order-processing-overlay" role="status" aria-live="polite">
          <div className="mock-order-processing-card">
            <div className="mock-order-orbit" aria-hidden="true"><i /><i /><b>✓</b></div>
            <span className="mock-order-processing-kicker">SECURE CHECKOUT</span>
            <h2>Confirming your order…</h2>
            <p>Please stay on this page for a moment. We&apos;re reserving your items and creating your confirmation.</p>
            <div className="mock-order-processing-progress"><i /></div>
            <small>Cash on Delivery · No payment is being charged online</small>
          </div>
        </div>
      ) : null}

      <form className="mock-checkout-layout mock-progressive-checkout mock-checkout-grouped" onSubmit={submit}>
        <section className="mock-checkout-form">
          <div className="mock-checkout-progress-wrap">
            <div className="mock-checkout-progress-top"><span>SECURE CHECKOUT</span><b>{progress}% complete</b></div>
            <div className="mock-checkout-progress-track"><i style={{ width: `${progress}%` }} /></div>
            <div className="mock-checkout-group-steps">
              {["Contact", "Delivery", "Confirm"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`${index === activeStage ? "active" : ""} ${index < activeStage ? "done" : ""}`}
                  onClick={() => index < activeStage && setActiveStage(index as Stage)}
                >
                  <span>{index < activeStage ? "✓" : index + 1}</span><b>{label}</b>
                </button>
              ))}
            </div>
          </div>

          {activeStage > 0 ? (
            <button type="button" className="mock-checkout-complete-summary" onClick={() => setActiveStage(0)}>
              <span>✓</span><div><small>Contact details</small><b data-replay-mask>{fields.fullName} · {fields.phone}{fields.email ? ` · ${fields.email}` : ""}</b></div><em>Edit</em>
            </button>
          ) : null}

          {activeStage > 1 ? (
            <button type="button" className="mock-checkout-complete-summary" onClick={() => setActiveStage(1)}>
              <span>✓</span><div><small>Delivery details</small><b data-replay-mask>{fields.address}, {fields.city}{fields.postcode ? ` ${fields.postcode}` : ""}</b></div><em>Edit</em>
            </button>
          ) : null}

          <div ref={stageRef} key={activeStage} className="mock-checkout-group-card">
            {activeStage === 0 ? (
              <>
                <div className="mock-progressive-step-heading"><span>STEP 1 OF 3</span><h2>Contact details</h2><p>Name, phone and email stay together in one simple form.</p></div>
                <div className="mock-checkout-group-grid">
                  <label className="field full"><span>Full name *</span><input data-clarity-mask="true" autoComplete="name" placeholder="Your full name" value={fields.fullName} onChange={(e) => update("fullName", e.target.value)} />{errors.fullName ? <small className="field-error">{errors.fullName}</small> : null}</label>
                  <label className="field"><span>Phone number *</span><input data-clarity-mask="true" autoComplete="tel" inputMode="tel" placeholder="03XX-XXXXXXX" value={fields.phone} onChange={(e) => update("phone", e.target.value)} />{errors.phone ? <small className="field-error">{errors.phone}</small> : null}</label>
                  <label className="field"><span>Email {required.email ? "*" : "(optional)"}</span><input data-clarity-mask="true" autoComplete="email" type="email" placeholder="you@example.com" value={fields.email} onChange={(e) => update("email", e.target.value)} />{errors.email ? <small className="field-error">{errors.email}</small> : null}</label>
                </div>
                <div className="mock-progressive-actions"><span /><button type="button" className="next" onClick={continueContact}>Continue to delivery →</button></div>
              </>
            ) : null}

            {activeStage === 1 ? (
              <>
                <div className="mock-progressive-step-heading"><span>STEP 2 OF 3</span><h2>Delivery details</h2><p>Tell us where to send your parcel. This whole section appears together.</p></div>
                <div className="mock-checkout-group-grid">
                  <label className="field"><span>City *</span><input list="pakistan-cities" autoComplete="address-level2" placeholder="Search your city" value={fields.city} onChange={(e) => update("city", e.target.value)} /><datalist id="pakistan-cities">{cities.map((city) => <option key={city.name} value={city.name} />)}</datalist>{selectedCity ? <small className="mock-step-success">✓ {selectedCity.deliveryMinDays}–{selectedCity.deliveryMaxDays} working days</small> : null}{errors.city ? <small className="field-error">{errors.city}</small> : null}</label>
                  <label className="field"><span>Postcode {required.postcode ? "*" : "(optional)"}</span><input data-clarity-mask="true" autoComplete="postal-code" inputMode="numeric" placeholder="e.g. 54000" value={fields.postcode} onChange={(e) => update("postcode", e.target.value)} />{errors.postcode ? <small className="field-error">{errors.postcode}</small> : null}</label>
                  <label className="field full"><span>Full delivery address *</span><textarea data-clarity-mask="true" autoComplete="street-address" rows={4} placeholder="House / flat, street, area, nearby landmark…" value={fields.address} onChange={(e) => update("address", e.target.value)} />{errors.address ? <small className="field-error">{errors.address}</small> : null}</label>
                  <label className="field full"><span>Order notes {required.orderNotes ? "*" : "(optional)"}</span><textarea data-clarity-mask="true" rows={3} placeholder="Landmark, preferred call time, delivery note…" value={fields.orderNotes} onChange={(e) => update("orderNotes", e.target.value)} />{errors.orderNotes ? <small className="field-error">{errors.orderNotes}</small> : null}</label>
                </div>
                <div className="mock-progressive-actions"><button type="button" className="back" onClick={() => setActiveStage(0)}>← Back</button><button type="button" className="next" onClick={continueDelivery}>Review order →</button></div>
              </>
            ) : null}

            {activeStage === 2 ? (
              <>
                <div className="mock-progressive-step-heading"><span>FINAL STEP</span><h2>Review & place order</h2><p>Check the details once, then place your Cash on Delivery order.</p></div>
                <div className="mock-checkout-review">
                  <div className="mock-checkout-review-row"><span>☎</span><div><small>Contact</small><b data-replay-mask>{fields.fullName} · {fields.phone}</b></div><button type="button" onClick={() => setActiveStage(0)}>Edit</button></div>
                  <div className="mock-checkout-review-row"><span>⌖</span><div><small>Deliver to</small><b data-replay-mask>{fields.address}, {fields.city}{fields.postcode ? ` ${fields.postcode}` : ""}</b></div><button type="button" onClick={() => setActiveStage(1)}>Edit</button></div>
                  <div className="mock-checkout-review-row"><span>▣</span><div><small>Delivery</small><b>Standard delivery · {selectedCity ? `${selectedCity.deliveryMinDays}–${selectedCity.deliveryMaxDays} working days` : "Tracked across Pakistan"}</b></div><strong>{deliveryFee ? money(deliveryFee) : "FREE"}</strong></div>
                  <div className="mock-checkout-review-row"><span>₨</span><div><small>Payment</small><b>Cash on Delivery</b></div><strong>COD</strong></div>
                  <label className="mock-checkout-terms mock-progressive-terms"><input type="checkbox" checked={fields.terms} onChange={(e) => update("terms", e.target.checked)} /><span>I agree to the terms and confirm my delivery details are correct.{errors.terms ? <b className="field-error"> {errors.terms}</b> : null}</span></label>
                  <button type="submit" className="mock-progressive-place-order" disabled={submitting || (required.terms && !fields.terms)}>{submitting ? <><span className="mock-order-button-spinner" /> Confirming order…</> : `Place order · ${money(total)} →`}</button>
                </div>
              </>
            ) : null}
          </div>

          <div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => update("website", e.target.value)} /></div>
          {serverError ? <div className="mock-checkout-error">{serverError}</div> : null}
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
          <button type="submit" className="mock-place-order" disabled={submitting || activeStage !== 2 || (required.terms && !fields.terms)}>{activeStage === 2 ? (submitting ? <><span className="mock-order-button-spinner" /> Confirming…</> : "Place order →") : activeStage === 0 ? "Complete contact details →" : "Complete delivery details →"}</button>
          <p className="mock-order-help">Need help? Call <b>0300-2026711</b> or message us on WhatsApp.</p>
        </aside>
      </form>
    </>
  );
}
