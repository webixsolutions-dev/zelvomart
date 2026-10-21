"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CalendarDays, Check, CircleCheck, Copy, PackageSearch, Video } from "lucide-react";
import { money, waLink } from "@store/lib/format";
import { site } from "@store/lib/site";
import { useConfirmedOrder } from "@store/lib/orders";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";
import { OrderTimeline } from "./OrderTimeline";

/** Adds `days` working days (Mon–Sat; Sundays skipped) to `from`. */
function addWorkingDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

/** “Thu 23 Oct – Tue 28 Oct”, from the order date and the delivery days in Settings. */
function deliveryRange(createdAt: string) {
  const start = new Date(createdAt);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${fmt(addWorkingDays(start, site.shipping.minDays))} – ${fmt(addWorkingDays(start, site.shipping.maxDays))}`;
}

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Address and city in one line, dropping parts and words the customer typed twice (e.g. the city repeated). */
function addressLine(address: string, city: string) {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [...address.split(/[,\n]+/), city]) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    const kept = words.filter((w, i) => {
      const k = w.toLowerCase().replace(/[^\p{L}\p{N}#-]/gu, "");
      // drop a word repeated back to back (“Lahore Lahore”) and a lone word already used earlier
      if (i > 0 && k === words[i - 1].toLowerCase().replace(/[^\p{L}\p{N}#-]/gu, "")) return false;
      return !(words.length === 1 && seen.has(k));
    });
    const part = kept.join(" ");
    if (!part) continue;
    const key = part.toLowerCase();
    if (parts.some((p) => p.toLowerCase() === key)) continue;
    // a part whose every word already appeared (e.g. “DHA, Lahore” after “DHA Lahore”) adds nothing
    const keys = kept.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}#-]/gu, ""));
    if (keys.every((k) => seen.has(k)) && parts.length) continue;
    keys.forEach((k) => seen.add(k));
    parts.push(part);
  }
  return parts.join(", ");
}

function CopyOrderNumber({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const t = document.createElement("textarea");
      t.value = id;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" className="confirm-copy" onClick={copy} aria-label={copied ? "Order number copied" : `Copy order number ${id}`}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function OrderConfirmed() {
  const params = useSearchParams();
  const id = params.get("id") || params.get("order");
  const { orders, ready } = useConfirmedOrder(id, params.get("key"));
  if (!ready) return <div className="container skeleton-block" />;
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>We couldn&apos;t find that order on this device.</h2>
          <p>If you placed an order, our team will contact you to confirm it. You can also track it with your order number.</p>
          <Link href="/track-your-order/" className="btn">
            Track an order <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const waText = `Hi Zelvomart! Confirming my order ${order.id}.\n${order.lines.map((l) => `• ${l.name}${l.variant ? ` (${l.variant})` : ""} × ${l.qty}`).join("\n")}\nTotal: ${money(order.total)} (COD)\nName: ${order.customer.name}\nCity: ${order.customer.city}`;

  return (
    <section className="section pt-sm confirm-page">
      <div className="container-narrow">
        <div className="confirm-card">
          <span className="confirm-ico">
            <CircleCheck size={40} />
          </span>
          <div className="eyebrow">Order placed</div>
          <h1>Thank you, {capitalise(order.customer.name.trim().split(/\s+/)[0])}!</h1>
          <div className="confirm-number">
            <span>
              <small>Order number</small>
              <strong>{order.id}</strong>
            </span>
            <CopyOrderNumber id={order.id} />
          </div>
          <p className="confirm-save">Save this number to track your order.</p>
          <p>
            Your order has been received. Our team will call or WhatsApp you on <strong>{order.customer.phone}</strong> to confirm before
            dispatch.
          </p>
          <div className="confirm-actions">
            <a className="btn wa" href={waLink(site.whatsappNumber, waText)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> Confirm instantly on WhatsApp
            </a>
            <Link className="btn ghost" href="/track-your-order/">
              <PackageSearch size={16} /> Track your order
            </Link>
            <Link className="btn ghost" href="/shop/">
              Continue shopping
            </Link>
          </div>
          <OrderTimeline step={0} />
          <p className="confirm-eta">
            <CalendarDays size={17} />
            <span>
              Expected delivery: <strong>{deliveryRange(order.createdAt)}</strong>
            </span>
          </p>
        </div>

        <div className="confirm-note">
          <span className="confirm-note-ico">
            <Video size={20} />
          </span>
          <p>Please record a video while opening your parcel. It helps us sort out any issue quickly.</p>
        </div>

        <div className="summary-box">
          <h3>Order summary</h3>
          <ul className="sum-items">
            {order.lines.map((l) => (
              <li key={l.key}>
                <span className="sum-thumb">
                  <Image src={l.image} alt="" width={56} height={56} />
                  <b>{l.qty}</b>
                </span>
                <span>
                  <strong>{l.name}</strong>
                  {l.variant && <small>{l.variant}</small>}
                </span>
                <strong>{money(l.price * l.qty)}</strong>
              </li>
            ))}
          </ul>
          <div className="sum-line">
            <span>Subtotal</span>
            <strong>{money(order.subtotal)}</strong>
          </div>
          <div className="sum-line">
            <span>Delivery</span>
            <span>{order.shipping === 0 ? <b className="free">FREE</b> : money(order.shipping)}</span>
          </div>
          {order.discount ? (
            <div className="sum-line discount">
              <span>Coupon {order.coupon}</span>
              <strong>−{money(order.discount)}</strong>
            </div>
          ) : null}
          <div className="sum-line total">
            <span>Total — Cash on Delivery</span>
            <strong>{money(order.total)}</strong>
          </div>
          <div className="ship-to">
            <strong>Delivering to</strong>
            <p>
              {order.customer.name} · {order.customer.phone}
            </p>
            <p className="ship-to-line">{addressLine(order.customer.address, order.customer.city)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
