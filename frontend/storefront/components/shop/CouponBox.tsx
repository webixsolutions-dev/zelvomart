"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, LoaderCircle, TicketPercent } from "lucide-react";
import { money } from "@/lib/format";
import { useShop } from "@/lib/store";

/**
 * “Apply coupon” box, shared by the cart and the checkout summary.
 * The applied coupon lives in the shop store, so a code applied in the cart arrives applied at checkout.
 */
export function CouponBox() {
  const { coupon, discount, applyCoupon, removeCoupon } = useShop();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const errId = useId();

  const toggle = () => {
    setOpen((o) => !o);
    if (!open) requestAnimationFrame(() => inputRef.current?.focus());
  };

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) {
      setError("Enter a coupon code first.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    const res = await applyCoupon(c);
    setBusy(false);
    if (!res.ok) setError(res.message);
    else {
      setCode("");
      setOpen(false);
    }
  };

  if (coupon) {
    return (
      <div className="coupon is-applied" role="status">
        <div className="coupon-toggle as-row">
          <span className="coupon-ico">
            <CircleCheck size={18} />
          </span>
          <span className="coupon-label">
            <strong>{coupon.code} applied</strong>
            <small>{discount > 0 ? `You save ${money(discount)}` : "Saving shows once items are in your cart"}</small>
          </span>
          <button type="button" className="coupon-remove" onClick={removeCoupon} aria-label={`Remove coupon ${coupon.code}`}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`coupon ${open ? "is-open" : ""}`}>
      <button type="button" className="coupon-toggle" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <span className="coupon-ico">
          <TicketPercent size={18} />
        </span>
        <span className="coupon-label">
          <strong>Apply coupon</strong>
          <small>Have a promo code? Add it here</small>
        </span>
        <ChevronDown size={18} className="coupon-chev" />
      </button>
      <div className="coupon-panel" id={panelId} hidden={!open}>
        <form className="coupon-form" onSubmit={apply} noValidate>
          <label htmlFor={`${panelId}-input`} className="sr-only">
            Coupon code
          </label>
          <input
            ref={inputRef}
            id={`${panelId}-input`}
            className={error ? "has-error" : ""}
            type="text"
            placeholder="Enter coupon code"
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError("");
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errId : undefined}
          />
          <button type="submit" className="coupon-apply" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" /> : "Apply"}
          </button>
        </form>
        {error && (
          <p className="coupon-msg error" id={errId} role="alert">
            <CircleAlert size={14} /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
