"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Banknote, CircleAlert, CreditCard, LoaderCircle, Lock, ShieldCheck, ShoppingBag } from "lucide-react";
import { getProductById } from "@store/lib/catalog";
import { money } from "@store/lib/format";
import { unitPrice, useShop } from "@store/lib/store";
import { useCheckoutTracking } from "@store/lib/orders";
import { FreeShippingMeter } from "@store/components/shop/FreeShippingMeter";
import { CouponBox } from "@store/components/shop/CouponBox";

const cities = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Bahawalpur", "Sargodha", "Abbottabad"];

type Form = { name: string; phone: string; email: string; city: string; address: string; notes: string };
const empty: Form = { name: "", phone: "", email: "", city: "", address: "", notes: "" };

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.name.trim().length < 3) e.name = "Please enter your full name.";
  if (!/^(\+92|0092|0)?3\d{9}$/.test(f.phone.replace(/[\s-]/g, ""))) e.phone = "Enter a valid Pakistani mobile number, e.g. 0300 1234567.";
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "That email doesn't look right.";
  if (f.city.trim().length < 2) e.city = "Please enter your city.";
  if (f.address.trim().length < 10) e.address = "Add house/street, area and a nearby landmark.";
  return e;
}

export function CheckoutView() {
  const router = useRouter();
  const { cart, ready, subtotal, shipping, coupon, discount, payable, placeOrder, notify } = useShop();
  const [form, setForm] = useState<Form>(empty);
  useCheckoutTracking(form);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The thank-you page is ready before the order is, so the hand-over after "Place Order" is instant.
  useEffect(() => {
    router.prefetch("/order-confirmed/");
  }, [router]);

  if (!ready) return <div className="container skeleton-block" />;

  if (cart.length === 0 && !submitting) {
    return (
      <div className="container">
        <div className="empty-state">
          <span className="empty-ico">
            <ShoppingBag size={30} />
          </span>
          <h2>Your cart is empty.</h2>
          <p>Add a few products to check out.</p>
          <Link href="/shop/" className="btn">
            Browse products <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const field = (k: keyof Form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [k]: e.target.value });
      if (errors[k]) setErrors({ ...errors, [k]: undefined });
    },
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `err-${k}` : undefined,
    className: `field ${errors[k] ? "has-error" : ""}`,
  });
  const err = (k: keyof Form) => errors[k] && <span className="field-error" id={`err-${k}`}>{errors[k]}</span>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    setTermsError(!terms);
    if (Object.keys(v).length || !terms) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".checkout-page [aria-invalid=true]")?.focus());
      return;
    }
    setSubmitting(true);
    let order;
    try {
      order = await placeOrder(
      {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      city: form.city.trim(),
      address: form.address.trim(),
      notes: form.notes.trim() || undefined,
      },
      { terms: true },
      );
    } catch (error) {
      setSubmitting(false);
      notify({ title: "We couldn't place your order", body: error instanceof Error ? error.message : "Please try again." });
      return;
    }
    // replace: the back button returns to the cart, not to a checkout for an order already placed.
    router.replace(`/order-confirmed/?id=${encodeURIComponent(order.id)}&key=${encodeURIComponent(order.key || "")}`);
  }

  return (
    <section className="section pt-sm">
      <div className="container checkout-grid">
        <form className="form-card" onSubmit={submit} noValidate aria-busy={submitting}>
          {submitting && (
            <div className="checkout-placing" role="status" aria-live="polite">
              <LoaderCircle size={30} className="checkout-placing-spin" aria-hidden="true" />
              <strong>Placing your order…</strong>
              <span>Please keep this page open.</span>
            </div>
          )}
          <div className="form-step">
            <span className="step-no">1</span>
            <div>
              <h2>Delivery details</h2>
              <p>We&apos;ll call or WhatsApp this number to confirm your order before dispatch.</p>
            </div>
          </div>
          <div className="fields">
            <label>
              Full name *
              <input {...field("name")} autoComplete="name" placeholder="Your full name" />
              {err("name")}
            </label>
            <label>
              Mobile number *
              <input {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" />
              {err("phone")}
            </label>
            <label>
              Email <span className="opt">(optional — for order updates)</span>
              <input {...field("email")} type="email" autoComplete="email" placeholder="you@example.com" />
              {err("email")}
            </label>
            <label>
              City *
              <input {...field("city")} list="pk-cities" autoComplete="address-level2" placeholder="e.g. Lahore" />
              <datalist id="pk-cities">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {err("city")}
            </label>
            <label className="full">
              Full delivery address *
              <input {...field("address")} autoComplete="street-address" placeholder="House #, street, area, nearby landmark" />
              {err("address")}
            </label>
            <label className="full">
              Order notes <span className="opt">(optional)</span>
              <textarea {...field("notes")} placeholder="Preferred delivery time, gift note, etc." rows={3} />
            </label>
          </div>

          <div className="form-step">
            <span className="step-no">2</span>
            <div>
              <h2>Payment</h2>
              <p>No advance payment needed.</p>
            </div>
          </div>
          <div className="pay-options">
            <label className="pay-option active">
              <input type="radio" name="pay" defaultChecked />
              <Banknote size={22} />
              <span>
                <strong>Cash on Delivery</strong>
                <small>Pay the rider in cash when your parcel arrives.</small>
              </span>
            </label>
            <label className="pay-option disabled">
              <input type="radio" name="pay" disabled />
              <CreditCard size={22} />
              <span>
                <strong>Card / JazzCash / Easypaisa</strong>
                <small>Coming soon</small>
              </span>
            </label>
          </div>

          <div className={`terms-check ${termsError ? "has-error" : ""}`}>
            <label>
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => {
                  setTerms(e.target.checked);
                  if (e.target.checked) setTermsError(false);
                }}
                required
                aria-invalid={termsError}
                aria-describedby={termsError ? "err-terms" : undefined}
              />
              <span>
                I agree to the <Link href="/terms-conditions/">Terms &amp; Conditions</Link> and <Link href="/privacy-policy/">Privacy Policy</Link>.
              </span>
            </label>
            {termsError && (
              <span className="terms-error" id="err-terms" role="alert">
                <CircleAlert size={14} /> Please accept the Terms &amp; Conditions to place your order
              </span>
            )}
          </div>

          <button className="btn block lg" type="submit" disabled={submitting}>
            <Lock size={16} /> Place Order — {money(payable)}
          </button>
        </form>

        <aside className="summary-box sticky">
          <h3>Your order</h3>
          <ul className="sum-items">
            {cart.map((l) => {
              const p = getProductById(l.id);
              if (!p) return null;
              return (
                <li key={l.key}>
                  <span className="sum-thumb">
                    <Image src={p.image} alt="" width={56} height={56} />
                    <b>{l.qty}</b>
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    {l.variant && <small>{l.variant}</small>}
                    {l.bundle && <small>Bundle · {l.bundle}% off</small>}
                  </span>
                  <strong>{money(unitPrice(p, l) * l.qty)}</strong>
                </li>
              );
            })}
          </ul>
          <FreeShippingMeter subtotal={subtotal} />
          <div className="sum-line">
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div className="sum-line">
            <span>Delivery</span>
            <span>{shipping === 0 ? <b className="free">FREE</b> : money(shipping)}</span>
          </div>
          <CouponBox />
          {coupon && discount > 0 && (
            <div className="sum-line discount">
              <span>Coupon {coupon.code}</span>
              <strong>−{money(discount)}</strong>
            </div>
          )}
          <div className="sum-line total">
            <span>Total (PKR)</span>
            <strong>{money(payable)}</strong>
          </div>
          <ul className="summary-assure">
            <li>
              <ShieldCheck size={16} /> Every item checked before dispatch
            </li>
            <li>
              <Banknote size={16} /> Pay only when you receive it
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
