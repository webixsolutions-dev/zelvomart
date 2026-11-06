"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { getProductById } from "@store/lib/catalog";
import { money, waLink } from "@store/lib/format";
import {
  CheckoutRateLimited,
  bundleLabel,
  lineTotal,
  useShop,
} from "@store/lib/store";
import { site } from "@store/lib/site";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";
import { CartNotes } from "@store/components/shop/CartNotes";
import { useCheckoutTracking } from "@store/lib/orders";
import { FreeShippingMeter } from "@store/components/shop/FreeShippingMeter";
import { advanceQuote, useAdvanceOffer } from "@store/lib/payments";
import { AddressInput } from "@store/components/shop/AddressInput";
import { CheckoutDock } from "@store/components/shop/CheckoutDock";
import { OrderSummary } from "@store/components/shop/OrderSummary";

type Form = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  notes: string;
};
const empty: Form = {
  name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  notes: "",
};

function validate(form: Form) {
  const errors: Partial<Record<keyof Form, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Please enter your full name.";
  if (!/^(\+92|0092|0)?3\d{9}$/.test(form.phone.replace(/[\s-]/g, "")))
    errors.phone = "Enter a Pakistani mobile number, e.g. 0300 1234567.";
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
    errors.email = "Enter a valid email address.";
  if (form.city.trim().length < 2) errors.city = "Please enter your city.";
  if (form.address.trim().length < 8)
    errors.address = "Add your house, street and area.";
  return errors;
}

export function CheckoutView() {
  const router = useRouter();
  const {
    cart,
    ready,
    subtotal,
    shipping,
    payable,
    placeOrder,
    completeOrder,
    notify,
  } = useShop();
  const offer = useAdvanceOffer();
  const [pay, setPay] = useState<"cod" | "advance">("cod");
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [detailsComplete, setDetailsComplete] = useState(false);
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState("");
  const submittingRef = useRef(false);
  const paymentHeading = useRef<HTMLButtonElement>(null);
  useCheckoutTracking(form);
  useEffect(() => {
    router.prefetch("/order-confirmed/");
  }, [router]);

  if (!ready) return <div className="container skeleton-block" />;
  const method = offer.available ? pay : "cod";
  const quote = advanceQuote(offer, subtotal, payable);
  const advanceOff = method === "advance" ? quote.discount : 0;
  const total = payable - advanceOff;
  const actionLabel = paymentOpen ? "Place order" : "Continue to payment";

  if (!cart.length && !submitting)
    return (
      <div className="container">
        <div className="empty-state">
          <ShoppingBag size={30} />
          <h2>Your cart is empty.</h2>
          <p>Add a few products to check out.</p>
          <Link href="/shop/" className="btn">
            Browse products <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );

  const change = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDetailsComplete(false);
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const field = (key: keyof Form) => ({
    id: `checkout-${key}`,
    value: form[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => change(key, event.target.value),
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `err-${key}` : undefined,
    className: `field${errors[key] ? " has-error" : ""}`,
  });
  const error = (key: keyof Form) =>
    errors[key] ? (
      <span className="field-error" id={`err-${key}`}>
        {errors[key]}
      </span>
    ) : null;
  const focusInvalid = () =>
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("#checkout-form [aria-invalid=true]")
        ?.focus(),
    );
  const checkDetails = () => {
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length) {
      setDetailsOpen(true);
      focusInvalid();
      return false;
    }
    setDetailsComplete(true);
    return true;
  };
  const continueToPayment = () => {
    if (!checkDetails()) return;
    setDetailsOpen(false);
    setPaymentOpen(true);
    requestAnimationFrame(() =>
      paymentHeading.current?.focus({ preventScroll: true }),
    );
    requestAnimationFrame(() =>
      paymentHeading.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      }),
    );
  };
  const whatsappText = () =>
    [
      "Hi Zelvomart! I'd like to order:",
      ...cart.map((line) => {
        const product = getProductById(line.id);
        return product
          ? `• ${product.name}${line.variant ? ` (${line.variant})` : ""} × ${line.bundle ? bundleLabel(line.qty) : line.qty} — ${money(lineTotal(product, line))}`
          : "";
      }),
      `Total: ${money(total)} (${method === "advance" ? "advance payment" : "cash on delivery"})`,
      form.name && `Name: ${form.name}`,
      form.city && `City: ${form.city}`,
    ]
      .filter(Boolean)
      .join("\n");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!paymentOpen) {
      continueToPayment();
      return;
    }
    if (!checkDetails()) return;
    setTermsError(!terms);
    if (!terms) {
      focusInvalid();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setRateLimited("");
    try {
      const order = await placeOrder(
        {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          city: form.city.trim(),
          address: form.address.trim(),
          notes: form.notes.trim() || undefined,
        },
        { terms: true, payment: method },
      );
      if (order.payPath) {
        completeOrder();
        router.replace(order.payPath);
        return;
      }
      router.replace(
        `/order-confirmed/?id=${encodeURIComponent(order.id)}&key=${encodeURIComponent(order.key || "")}`,
      );
    } catch (cause) {
      submittingRef.current = false;
      setSubmitting(false);
      if (cause instanceof CheckoutRateLimited) setRateLimited(cause.message);
      else
        notify({
          title: "We couldn't place your order",
          body: cause instanceof Error ? cause.message : "Please try again.",
        });
    }
  }

  return (
    <section className="section pt-sm checkout-flow">
      <div className="container checkout-grid">
        <form
          id="checkout-form"
          className="checkout-steps"
          onSubmit={submit}
          noValidate
          aria-busy={submitting}
        >
          {submitting && (
            <div className="checkout-placing" role="status" aria-live="polite">
              <LoaderCircle size={30} className="checkout-placing-spin" />
              <strong>Placing your order…</strong>
              <span>Please keep this page open.</span>
            </div>
          )}
          <section className="checkout-step">
            <h2 className="checkout-step-title">
              <button
                type="button"
                className="checkout-step-toggle"
                aria-expanded={detailsOpen}
                aria-controls="checkout-details"
                onClick={() => setDetailsOpen((open) => !open)}
              >
                <span
                  className={`step-no${detailsComplete ? " complete" : ""}`}
                >
                  {detailsComplete ? <Check size={17} /> : "1"}
                </span>
                <span>Delivery details</span>
                <span className="checkout-step-edit">
                  {!detailsOpen && detailsComplete ? (
                    "Edit"
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </span>
              </button>
            </h2>
            {!detailsOpen && (
              <div className="checkout-details-preview" data-replay-mask>
                {detailsComplete ? (
                  <>
                    <strong>{form.name}</strong>
                    <span>
                      {form.address}, {form.city}
                    </span>
                    <span>{form.phone}</span>
                  </>
                ) : (
                  <span>Add your name, phone and delivery address.</span>
                )}
              </div>
            )}
            <div id="checkout-details" hidden={!detailsOpen}>
              <p className="checkout-step-description">
                Where should we send your order?
              </p>
              <div className="fields">
                <label htmlFor="checkout-name">
                  Full name *
                  <input
                    {...field("name")}
                    autoComplete="name"
                    maxLength={100}
                    placeholder="Your full name"
                  />
                  {error("name")}
                </label>
                <label htmlFor="checkout-phone">
                  Mobile number *
                  <input
                    {...field("phone")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    placeholder="0300 1234567"
                  />
                  {error("phone")}
                </label>
                <label className="full" htmlFor="checkout-email">
                  Email{" "}
                  <span className="opt">(optional, for order updates)</span>
                  <input
                    {...field("email")}
                    type="email"
                    autoComplete="email"
                    maxLength={190}
                    placeholder="you@example.com"
                  />
                  {error("email")}
                </label>
                <div className="full checkout-field-group">
                  <label htmlFor="checkout-city">City *</label>
                  <AddressInput
                    kind="city"
                    id="checkout-city"
                    value={form.city}
                    onValueChange={(value) => change("city", value)}
                    className={`field${errors.city ? " has-error" : ""}`}
                    aria-invalid={Boolean(errors.city)}
                    aria-describedby={errors.city ? "err-city" : "city-help"}
                    autoComplete="address-level2"
                    maxLength={100}
                    placeholder="Start typing your city"
                  />
                  {error("city")}
                  <small id="city-help" className="checkout-field-hint">
                    Choose a suggestion or enter your city.
                  </small>
                </div>
                <div className="full checkout-field-group">
                  <label htmlFor="checkout-address">
                    Full delivery address *
                  </label>
                  <AddressInput
                    kind="address"
                    city={form.city}
                    id="checkout-address"
                    value={form.address}
                    onValueChange={(value) => change("address", value)}
                    className={`field${errors.address ? " has-error" : ""}`}
                    aria-invalid={Boolean(errors.address)}
                    aria-describedby={
                      errors.address ? "err-address" : "address-help"
                    }
                    autoComplete="street-address"
                    maxLength={500}
                    placeholder="House / flat, street, area and landmark"
                  />
                  {error("address")}
                  <small id="address-help" className="checkout-field-hint">
                    Include your house or flat number. Suggestions are optional.
                  </small>
                </div>
                <label className="full" htmlFor="checkout-notes">
                  Order notes <span className="opt">(optional)</span>
                  <textarea
                    {...field("notes")}
                    rows={2}
                    maxLength={1000}
                    placeholder="Anything we should know about your delivery?"
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn block lg checkout-continue"
                onClick={continueToPayment}
              >
                Continue to payment <ArrowRight size={17} />
              </button>
            </div>
          </section>

          <section className="checkout-step">
            <h2 className="checkout-step-title">
              <button
                ref={paymentHeading}
                type="button"
                className="checkout-step-toggle"
                aria-expanded={paymentOpen}
                aria-controls="checkout-payment"
                onClick={() => setPaymentOpen((open) => !open)}
              >
                <span className="step-no">2</span>
                <span>Payment</span>
                <ChevronDown size={18} className="checkout-step-edit" />
              </button>
            </h2>
            {!paymentOpen && (
              <p className="checkout-step-description">
                Choose cash on delivery or pay in advance.
              </p>
            )}
            <div id="checkout-payment" hidden={!paymentOpen}>
              <p className="checkout-step-description">
                Choose what works for you.
              </p>
              {offer.available && offer.demo && (
                <p className="pay-demo-banner" role="note">
                  <TriangleAlert size={16} /> DEMO — do not send money.
                </p>
              )}
              <div
                className="pay-options"
                role="radiogroup"
                aria-label="Payment method"
              >
                <label
                  className={`pay-option${method === "cod" ? " active" : ""}`}
                >
                  <input
                    type="radio"
                    name="pay"
                    value="cod"
                    checked={method === "cod"}
                    onChange={() => setPay("cod")}
                  />
                  <span className="checkout-payment-icon">
                    <Banknote size={23} />
                  </span>
                  <span>
                    <strong>Cash on delivery</strong>
                    <small>Pay cash when your parcel arrives.</small>
                  </span>
                </label>
                {offer.available && (
                  <label
                    className={`pay-option${method === "advance" ? " active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      value="advance"
                      checked={method === "advance"}
                      onChange={() => setPay("advance")}
                    />
                    <span className="checkout-payment-icon">
                      <Smartphone size={23} />
                    </span>
                    <span>
                      <strong>
                        Pay in advance{" "}
                        <em className="pay-badge">
                          {quote.discount > 0
                            ? `Save ${money(quote.discount)}`
                            : `Save ${money(quote.flat)}`}
                        </em>
                      </strong>
                      <small>Use your bank app, Easypaisa or JazzCash.</small>
                      <small className="checkout-refund-note">
                        <RotateCcw size={13} /> Full refund if cancelled before
                        dispatch.
                      </small>
                    </span>
                  </label>
                )}
              </div>
              {method === "advance" && quote.shortfall > 0 && (
                <p className="pay-shortfall">
                  Add {money(quote.shortfall)} more to qualify for the{" "}
                  {money(quote.flat)} advance payment saving.
                </p>
              )}
              {method === "advance" && (
                <p className="checkout-refund-link">
                  Account name:{" "}
                  <strong>{offer.accountName || "Zelvomart"}</strong>.{" "}
                  <Link
                    href="/refund_returns/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Refund policy
                  </Link>
                </p>
              )}
              <div className={`terms-check${termsError ? " has-error" : ""}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(event) => {
                      setTerms(event.target.checked);
                      if (event.target.checked) setTermsError(false);
                    }}
                    aria-invalid={termsError}
                    aria-describedby={termsError ? "err-terms" : undefined}
                  />
                  <span>
                    I agree to the{" "}
                    <Link
                      href="/terms-conditions/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Terms &amp; Conditions
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy-policy/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {termsError && (
                  <span className="terms-error" id="err-terms" role="alert">
                    <CircleAlert size={14} /> Please accept the terms to place
                    your order.
                  </span>
                )}
              </div>
              <button
                className="btn block lg"
                type="submit"
                disabled={submitting}
              >
                <Lock size={16} />
                Place order{" "}
                — {money(total)}
              </button>
              <p className="checkout-final-note">
                {method === "advance"
                  ? "Pay securely in your own banking app on the next page."
                  : "No payment is needed now."}
              </p>
            </div>
          </section>
          {rateLimited && (
            <div className="checkout-limited" role="alert">
              <p>
                <CircleAlert size={16} />
                {rateLimited}
              </p>
              <a
                className="btn wa-outline"
                href={waLink(site.whatsappNumber, whatsappText())}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon /> Order on WhatsApp
              </a>
            </div>
          )}
        </form>
        <aside
          className="summary-box sticky checkout-order-summary"
          id="checkout-order-summary"
        >
          <h3>Your order</h3>
          <CartNotes />
          <OrderSummary advanceDiscount={advanceOff} />
          <FreeShippingMeter subtotal={subtotal} free={shipping === 0} />
          <p className="checkout-summary-note">
            <ShieldCheck size={16} /> Your total includes delivery and all
            savings.
          </p>
        </aside>
      </div>
      <CheckoutDock
        total={total}
        advanceDiscount={advanceOff}
        label={actionLabel}
        form="checkout-form"
        busy={submitting}
      />
    </section>
  );
}
