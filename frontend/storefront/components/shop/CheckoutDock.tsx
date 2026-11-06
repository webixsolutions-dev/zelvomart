"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronUp, LoaderCircle, X } from "lucide-react";
import { money } from "@store/lib/format";
import { OrderSummary } from "./OrderSummary";

type Props = {
  total: number;
  advanceDiscount?: number;
  label: string;
  href?: string;
  form?: string;
  busy?: boolean;
};

export function CheckoutDock({
  total,
  advanceDiscount = 0,
  label,
  href,
  form,
  busy = false,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const close = () => {
    dialog.current?.close();
  };

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editing = document.activeElement?.matches(
        "input,textarea,select,[contenteditable=true]",
      );
      setKeyboard(
        Boolean(
          editing && viewport && window.innerHeight - viewport.height > 150,
        ),
      );
    };
    viewport?.addEventListener("resize", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

  const action = (inSheet = false) =>
    href ? (
      <Link
        className="btn block"
        href={href}
        onClick={inSheet ? close : undefined}
      >
        {label}
        <ArrowRight size={16} />
      </Link>
    ) : (
      <button
        className="btn block"
        type="submit"
        form={form}
        disabled={busy}
        onClick={inSheet ? close : undefined}
      >
        {busy ? <LoaderCircle size={17} className="spin" /> : null}
        {busy ? "Placing your order…" : label}
        {!busy && <ArrowRight size={16} />}
      </button>
    );

  return (
    <>
      <div
        className={`checkout-mobile-bar${keyboard ? " keyboard-open" : ""}`}
        aria-label="Order total and next step"
      >
        <button
          type="button"
          ref={trigger}
          className="checkout-total-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          <span>
            <small>Order total</small>
            <strong>{money(total)}</strong>
          </span>
          <ChevronUp size={18} />
          <span className="sr-only">View order summary and coupon</span>
        </button>
        {action()}
      </div>
      <dialog
        className="checkout-summary-sheet"
        ref={dialog}
        aria-labelledby={heading}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientY < r.top ||
            event.clientX < r.left ||
            event.clientX > r.right
          )
            close();
        }}
      >
        <div className="checkout-sheet-heading">
          <h2 id={heading}>Order summary</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label="Close order summary"
            autoFocus
          >
            <X size={22} />
          </button>
        </div>
        <div className="checkout-sheet-content">
          <OrderSummary advanceDiscount={advanceDiscount} />
        </div>
        <div className="checkout-sheet-action">{action(true)}</div>
      </dialog>
    </>
  );
}
