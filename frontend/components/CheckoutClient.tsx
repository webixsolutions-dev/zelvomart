"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { clearPersistedCart, useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { trackStoreEvent, readCookie } from "@/lib/client-tracking";
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

type StepKey = "fullName" | "phone" | "email" | "city" | "address" | "postcode" | "orderNotes" | "review";
type Step = { key: StepKey; label: string; eyebrow: string; optional?: boolean };

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
  const { items, subtotal, bundleSaving, ready } = useCart();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const abandonTimer = useRef<number | null>(null);
  const autoAdvanceTimer = useRef<number | null>(null);
  const stepCardRef = useRef<HTMLDivElement | null>(null);
  const checkoutTracked = useRef(false);

  const deliveryFee = useMemo(() => {
    if (delivery.mode === "FLAT") return Number(delivery.flatRate || 0);
    if (delivery.mode === "FREE_ABOVE") return subtotal >= Number(delivery.freeAbove || 0) ? 0 : Number(delivery.flatRate || 0);
    return 0;
  }, [delivery, subtotal]);
  const codFee = Number(delivery.codFee || 0);
  const total = subtotal + deliveryFee + codFee;

  const steps = useMemo<Step[]>(() => [
    { key: "fullName", label: "Your name", eyebrow: "STEP 1" },
    { key: "phone", label: "Phone number", eyebrow: "STEP 2" },
    { key: "email", label: "Email address", eyebrow: "STEP 3", optional: !required.email },
    { key: "city", label: "Delivery city", eyebrow: "STEP 4" },
    { key: "address", label: "Full address", eyebrow: "STEP 5" },
    { key: "postcode", label: "Postcode", eyebrow: "STEP 6", optional: !required.postcode },
    { key: "orderNotes", label: "Order notes", eyebrow: "STEP 7", optional: !required.orderNotes },
    { key: "review", label: "Review & place order", eyebrow: "FINAL STEP" },
  ], [required.email, required.orderNotes, required.postcode]);

  const isStepValid = (key: StepKey, values = fields) => {
    if (key === "fullName") return values.fullName.trim().length >= 2;
    if (key === "phone") return normalizedPhone(values.phone).length >= 10;
    if (key === "email") return !values.email.trim() ? !required.email : /^\S+@\S+\.\S+$/.test(values.email.trim());
    if (key === "city") return values.city.trim().length >= 2;
    if (key === "address") return values.address.trim().length >= 6;
    if (key === "postcode") return !values.postcode.trim() ? !required.postcode : values.postcode.trim().length >= 3;
    if (key === "orderNotes") return !values.orderNotes.trim() ? !required.orderNotes : values.orderNotes.trim().length >= 2;
    if (key === "review") return !required.terms || values.terms;
    return false;
  };

  const firstIncompleteStep = (values: Fields) => {
    const index = steps.findIndex((step) => step.key !== "review" && !isStepValid(step.key, values));
    return index === -1 ? steps.length - 1 : index;
  };

  useEffect(() => {
    let nextFields = empty;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) nextFields = { ...empty, ...JSON.parse(saved) };
      if (!sessionStorage.getItem(IDEMPOTENCY_KEY)) sessionStorage.setItem(IDEMPOTENCY_KEY, crypto.randomUUID());
    } catch {}
    setFields(nextFields);
    setActiveStep(firstIncompleteStep(nextFields));
    setRestored(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }, 1100);
    return () => { if (abandonTimer.current) window.clearTimeout(abandonTimer.current); };
  }, [fields.phone, fields.fullName, fields.email, fields.city, fields.address, items, ready]);

  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  };

  const goToStep = (index: number) => {
    if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current);
    setActiveStep(Math.max(0, Math.min(steps.length - 1, index)));
  };

  const currentStep = steps[activeStep] || steps[0];

  const advance = (manual = false) => {
    if (!currentStep || currentStep.key === "review") return;
    if (!isStepValid(currentStep.key)) {
      if (currentStep.optional && manual) {
        goToStep(activeStep + 1);
        return;
      }
      const messages: Partial<Record<StepKey, string>> = {
        fullName: "Enter your full name.",
        phone: "Enter a valid phone number.",
        email: "Enter a valid email address.",
        city: "Enter your delivery city.",
        address: "Enter your complete delivery address.",
        postcode: "Enter a valid postcode.",
        orderNotes: "Add an order note or skip this step.",
      };
      setErrors((current) => ({ ...current, [currentStep.key]: messages[currentStep.key] || "Please complete this field." }));
      return;
    }
    goToStep(activeStep + 1);
  };

  useEffect(() => {
    if (!restored || currentStep.key === "review") return;
    if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current);
    if (!isStepValid(currentStep.key)) return;

    // Optional blank fields deliberately wait for Skip; typed valid values still auto-advance.
    const raw = currentStep.key === "email" || currentStep.key === "postcode" || currentStep.key === "orderNotes"
      ? String(fields[currentStep.key] || "").trim()
      : "filled";
    if (currentStep.optional && !raw) return;

    autoAdvanceTimer.current = window.setTimeout(() => {
      setActiveStep((index) => Math.min(steps.length - 1, index + 1));
    }, currentStep.key === "address" || currentStep.key === "orderNotes" ? 1050 : 750);

    return () => {
      if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current);
    };
  }, [fields, currentStep.key, currentStep.optional, restored, steps.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const target = stepCardRef.current?.querySelector<HTMLElement>("input:not([type='hidden']), textarea");
      target?.focus();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [activeStep]);

  const validateAll = () => {
    const next: Record<string, string> = {};
    if (!fields.fullName.trim()) next.fullName = "Full name is required.";
    if (normalizedPhone(fields.phone).length < 10) next.phone = "Enter a valid phone number.";
    if (required.email && !fields.email.trim()) next.email = "Email is required.";
    if (fields.email && !/^\S+@\S+\.\S+$/.test(fields.email)) next.email = "Enter a valid email.";
    if (!fields.city.trim()) next.city = "City is required.";
    if (!fields.address.trim()) next.address = "Address is required.";
    if (required.postcode && !fields.postcode.trim()) next.postcode = "Postcode is required.";
    if (required.orderNotes && !fields.orderNotes.trim()) next.orderNotes = "Order notes are required.";
    if (required.terms && !fields.terms) next.terms = "Please accept the terms.";
    setErrors(next);
    Object.keys(next).forEach((field) => { try { window.clarity?.("event", `checkout_error_${field}`); } catch {} });
    if (Object.keys(next).length) {
      const badIndex = steps.findIndex((step) => step.key !== "review" && Boolean(next[step.key]));
      if (badIndex >= 0) goToStep(badIndex);
      else goToStep(steps.length - 1);
    }
    return !Object.keys(next).length;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !items.length || submitting || redirecting || !validateAll()) return;
    setSubmitting(true);
    setServerError("");
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

      // Keep React cart state intact while leaving checkout so the successful
      // response never flashes "Your cart is empty". Clear only the persisted
      // cookie, then perform a hard replace; the success page mounts with an
      // empty cart while the replay session survives in sessionStorage.
      setRedirecting(true);
      clearPersistedCart();
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      const successUrl = `/checkout/success/${encodeURIComponent(data.orderNumber)}?key=${encodeURIComponent(data.id)}`;
      window.location.replace(successUrl);
    } catch (error) {
      setServerError(error instanceof Error ? error.message.replace(/_/g, " ") : "Could not place order");
      setSubmitting(false);
    }
  };

  const handleEnter = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.currentTarget.tagName === "TEXTAREA") return;
    event.preventDefault();
    advance(true);
  };

  if (!ready || !restored) {
    return <div className="mock-checkout-loading" aria-live="polite"><span /><b>Loading your secure checkout…</b></div>;
  }

  if (redirecting) {
    return <div className="mock-checkout-redirect" aria-live="polite"><span>✓</span><h2>Order placed</h2><p>Opening your confirmation…</p></div>;
  }

  if (!items.length) {
    return <div className="content-card text-center"><h2>Your cart is empty</h2><p>Add a product before checking out.</p><a href="/shop" className="btn-primary mt-4">Shop products</a></div>;
  }

  const selectedCity = cities.find((city) => city.name.toLowerCase() === fields.city.trim().toLowerCase());
  const progress = Math.round(((activeStep + 1) / steps.length) * 100);

  const renderCurrentStep = () => {
    if (currentStep.key === "fullName") return <>
      <label htmlFor="checkout-full-name">What should we call you?</label>
      <input id="checkout-full-name" data-clarity-mask="true" autoComplete="name" placeholder="Your full name" value={fields.fullName} onKeyDown={handleEnter} onChange={(e) => update("fullName", e.target.value)} />
      {errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}
    </>;

    if (currentStep.key === "phone") return <>
      <label htmlFor="checkout-phone">Your phone number</label>
      <input id="checkout-phone" data-clarity-mask="true" autoComplete="tel" inputMode="tel" placeholder="03XX-XXXXXXX" value={fields.phone} onKeyDown={handleEnter} onChange={(e) => update("phone", e.target.value)} />
      <small>We use this to confirm your COD order and delivery.</small>
      {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
    </>;

    if (currentStep.key === "email") return <>
      <label htmlFor="checkout-email">Email address {required.email ? "*" : "(optional)"}</label>
      <input id="checkout-email" data-clarity-mask="true" autoComplete="email" type="email" placeholder="you@example.com" value={fields.email} onKeyDown={handleEnter} onChange={(e) => update("email", e.target.value)} />
      <small>Useful for order updates and your receipt.</small>
      {errors.email ? <span className="field-error">{errors.email}</span> : null}
    </>;

    if (currentStep.key === "city") return <>
      <label htmlFor="checkout-city">Which city are we delivering to?</label>
      <input id="checkout-city" list="pakistan-cities" autoComplete="address-level2" placeholder="Search your city" value={fields.city} onKeyDown={handleEnter} onChange={(e) => update("city", e.target.value)} />
      <datalist id="pakistan-cities">{cities.map((city) => <option key={city.name} value={city.name} />)}</datalist>
      {selectedCity ? <small className="mock-step-success">✓ Estimated delivery: {selectedCity.deliveryMinDays}–{selectedCity.deliveryMaxDays} working days</small> : <small>Start typing your city name.</small>}
      {errors.city ? <span className="field-error">{errors.city}</span> : null}
    </>;

    if (currentStep.key === "address") return <>
      <label htmlFor="checkout-address">Full delivery address</label>
      <textarea id="checkout-address" data-clarity-mask="true" autoComplete="street-address" rows={4} placeholder="House / flat, street, area, nearby landmark…" value={fields.address} onChange={(e) => update("address", e.target.value)} />
      <small>Include enough detail for the rider to find you easily.</small>
      {errors.address ? <span className="field-error">{errors.address}</span> : null}
    </>;

    if (currentStep.key === "postcode") return <>
      <label htmlFor="checkout-postcode">Postcode {required.postcode ? "*" : "(optional)"}</label>
      <input id="checkout-postcode" data-clarity-mask="true" autoComplete="postal-code" inputMode="numeric" placeholder="e.g. 54000" value={fields.postcode} onKeyDown={handleEnter} onChange={(e) => update("postcode", e.target.value)} />
      {errors.postcode ? <span className="field-error">{errors.postcode}</span> : null}
    </>;

    if (currentStep.key === "orderNotes") return <>
      <label htmlFor="checkout-notes">Anything we should know? {required.orderNotes ? "*" : "(optional)"}</label>
      <textarea id="checkout-notes" rows={4} placeholder="Landmark, preferred call time, delivery note…" value={fields.orderNotes} onChange={(e) => update("orderNotes", e.target.value)} />
      {errors.orderNotes ? <span className="field-error">{errors.orderNotes}</span> : null}
    </>;

    return <div className="mock-checkout-review">
      <div className="mock-checkout-review-row"><span>☎</span><div><small>Contact</small><b>{fields.fullName} · {fields.phone}</b></div><button type="button" onClick={() => goToStep(0)}>Edit</button></div>
      <div className="mock-checkout-review-row"><span>⌖</span><div><small>Deliver to</small><b>{fields.address}, {fields.city}{fields.postcode ? ` ${fields.postcode}` : ""}</b></div><button type="button" onClick={() => goToStep(3)}>Edit</button></div>
      <div className="mock-checkout-review-row"><span>▣</span><div><small>Delivery</small><b>Standard delivery · {selectedCity ? `${selectedCity.deliveryMinDays}–${selectedCity.deliveryMaxDays} working days` : "Tracked across Pakistan"}</b></div><strong>{deliveryFee ? money(deliveryFee) : "FREE"}</strong></div>
      <div className="mock-checkout-review-row"><span>₨</span><div><small>Payment</small><b>Cash on Delivery</b></div><strong>COD</strong></div>
      <label className="mock-checkout-terms mock-progressive-terms"><input type="checkbox" checked={fields.terms} onChange={(e) => update("terms", e.target.checked)} /><span>I agree to the terms and confirm my delivery details are correct.{errors.terms ? <b className="field-error"> {errors.terms}</b> : null}</span></label>
      <button type="submit" className="mock-progressive-place-order" disabled={submitting || (required.terms && !fields.terms)}>{submitting ? "Placing order…" : `Place order · ${money(total)} →`}</button>
    </div>;
  };

  return (
    <form className="mock-checkout-layout mock-progressive-checkout" onSubmit={submit}>
      <section className="mock-checkout-form">
        <div className="mock-checkout-progress-wrap">
          <div className="mock-checkout-progress-top"><span>{currentStep.eyebrow}</span><b>{progress}% complete</b></div>
          <div className="mock-checkout-progress-track"><i style={{ width: `${progress}%` }} /></div>
          <div className="mock-checkout-step-dots" aria-label="Checkout progress">
            {steps.map((step, index) => <button key={step.key} type="button" className={`${index === activeStep ? "active" : ""} ${index < activeStep || (index !== steps.length - 1 && isStepValid(step.key)) ? "done" : ""}`} onClick={() => { if (index <= firstIncompleteStep(fields) || index < activeStep) goToStep(index); }} aria-label={step.label}><span>{index < activeStep || (index !== steps.length - 1 && isStepValid(step.key)) ? "✓" : index + 1}</span><small>{step.label}</small></button>)}
          </div>
        </div>

        <div ref={stepCardRef} key={currentStep.key} className="mock-progressive-step-card">
          <div className="mock-progressive-step-heading"><span>{currentStep.eyebrow}</span><h2>{currentStep.label}</h2><p>Fill this in and we'll move you to the next step automatically.</p></div>
          <div className="mock-progressive-field">{renderCurrentStep()}</div>
          {currentStep.key !== "review" ? <div className="mock-progressive-actions">
            {activeStep > 0 ? <button type="button" className="back" onClick={() => goToStep(activeStep - 1)}>← Back</button> : <span />}
            <div>
              {currentStep.optional ? <button type="button" className="skip" onClick={() => goToStep(activeStep + 1)}>Skip</button> : null}
              <button type="button" className="next" onClick={() => advance(true)}>Continue →</button>
            </div>
          </div> : null}
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
        <button type="submit" className="mock-place-order" disabled={submitting || activeStep !== steps.length - 1 || (required.terms && !fields.terms)}>{activeStep === steps.length - 1 ? (submitting ? "Placing order…" : "Place order →") : `Complete step ${activeStep + 1} →`}</button>
        <p className="mock-order-help">Need help? Call <b>0300-2026711</b> or message us on WhatsApp.</p>
      </aside>
    </form>
  );
}
