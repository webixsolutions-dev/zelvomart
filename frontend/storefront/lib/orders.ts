"use client";

import { useEffect, useRef, useState } from "react";
import { trackStoreEvent } from "@/lib/client-tracking";
import { getReplaySessionId, getReplayVisitorId } from "@/lib/session-replay-client";
import { getProductById, type Product } from "./catalog";
import { PLACED_ORDER_KEY, unitPrice, useShop, type CartLine, type Order } from "./store";

/**
 * Order and event hooks for the design's pages. They keep the previous storefront's behaviour:
 * the same backend calls and the same Meta/TikTok/GA4 events at the same moments.
 */

type ConfirmationItem = {
  id: string;
  productId?: string | null;
  sku: string;
  title: string;
  variantLabel?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl?: string | null;
};
type Confirmation = {
  id: string;
  orderNumber: string;
  createdAt: string;
  fullName: string;
  phone: string;
  email?: string | null;
  city: string;
  address: string;
  orderNotes?: string | null;
  couponCode?: string | null;
  couponDiscount?: number | string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: ConfirmationItem[];
  test?: boolean;
  staffCreated?: boolean;
  blocklistedAtOrder?: boolean;
};

function toDesignOrder(o: Confirmation): Order {
  const discount = Number(o.couponDiscount || 0);
  return {
    id: o.orderNumber,
    key: o.id,
    createdAt: o.createdAt,
    lines: o.items.map((i) => ({
      key: i.id,
      id: i.productId || i.sku,
      variant: i.variantLabel || undefined,
      qty: i.quantity,
      name: i.title,
      price: Number(i.unitPrice),
      image: i.imageUrl || getProductById(String(i.productId))?.image || "/brand/zelvomart-logo.png",
    })),
    subtotal: Number(o.subtotal),
    shipping: Number(o.deliveryFee),
    ...(discount > 0 ? { discount, coupon: o.couponCode || undefined } : {}),
    total: Number(o.total),
    terms: true,
    customer: { name: o.fullName, phone: o.phone, email: o.email || undefined, city: o.city, address: o.address, notes: o.orderNotes || undefined },
    payment: "cod",
  };
}

type PlacedOrder = Order & { cartCleared?: boolean };

/** The order this tab just placed (saved by placeOrder), if it is the one in the URL. */
function placedOrder(orderNumber: string): PlacedOrder | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PLACED_ORDER_KEY) || "null") as PlacedOrder | null;
    return saved && saved.id === orderNumber ? saved : null;
  } catch {
    return null;
  }
}

/** Empties the cart once per placed order, so reopening the thank-you page later never clears a new cart. */
function clearOnce(saved: PlacedOrder, completeOrder: () => void) {
  if (saved.cartCleared) return;
  completeOrder();
  try {
    sessionStorage.setItem(PLACED_ORDER_KEY, JSON.stringify({ ...saved, cartCleared: true }));
  } catch {}
}

/**
 * The order on the thank-you page. It renders at once from the copy placeOrder saved in this tab,
 * then refreshes from GET /api/orders/confirmation/:orderNumber?key=… (the key is the private id only
 * the browser that placed the order has) and replaces it. Purchase still fires only from the backend
 * confirmation, once, with the order number as the event id, exactly as PurchaseClient did.
 * Once the order is on screen the cart is emptied (completeOrder), never earlier.
 */
export function useConfirmedOrder(orderNumber: string | null, key: string | null) {
  const { completeOrder } = useShop();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!orderNumber) {
      setReady(true);
      return;
    }
    const saved = placedOrder(orderNumber);
    if (saved) {
      setOrders([saved]);
      setReady(true);
      clearOnce(saved, completeOrder);
    }
    const orderKey = key || saved?.key;
    if (!orderKey) {
      setReady(true);
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/store-proxy/api/orders/confirmation/${encodeURIComponent(orderNumber)}?key=${encodeURIComponent(orderKey)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((o: Confirmation | null) => {
        if (controller.signal.aborted) return;
        if (o) {
          setOrders([toDesignOrder(o)]);
          firePurchase(o);
        } else if (saved) {
          // The local order copy keeps confirmation useful during a backend outage. Send
          // the browser Purchase once the pixel is ready; the server job retries separately.
          fireSavedPurchase(saved);
        }
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => controller.abort();
  }, [orderNumber, key, completeOrder]);
  return { orders, ready };
}

function firePurchase(o: Confirmation) {
  if (o.test || o.staffCreated || o.blocklistedAtOrder) return;
  sendPurchase({
    id: o.id,
    orderNumber: o.orderNumber,
    total: Number(o.total),
    items: o.items.map((i) => ({ sku: i.sku, title: i.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    customer: { name: o.fullName, phone: o.phone, email: o.email || undefined, city: o.city },
  });
}

function fireSavedPurchase(o: PlacedOrder) {
  sendPurchase({
    id: o.key || o.id,
    orderNumber: o.id,
    total: Number(o.total),
    items: o.lines.map((i) => ({ sku: i.variant || i.id, title: i.name, quantity: i.qty, unitPrice: Number(i.price) })),
    customer: o.customer,
  });
}

function sendPurchase(o: { id: string; orderNumber: string; total: number; items: { sku: string; title: string; quantity: number; unitPrice: number }[]; customer: { name: string; phone: string; email?: string; city: string } }) {
  const flag = `zm_purchase_fired_${o.id}`;
  try { if (localStorage.getItem(flag)) return; } catch {}
  const skus = o.items.map((i) => i.sku);
  trackStoreEvent(
    "Purchase",
    {
      content_ids: skus,
      content_type: "product",
      contents: o.items.map((i) => ({ id: i.sku, content_id: i.sku, content_name: i.title, quantity: i.quantity || 1, item_price: Number(i.unitPrice) || 0, price: Number(i.unitPrice) || 0 })),
      num_items: o.items.reduce((sum, i) => sum + (i.quantity || 0), 0),
      value: Number(o.total),
      currency: "PKR",
      order_id: o.orderNumber,
    },
    {
      eventId: o.orderNumber,
      metaUserData: (() => {
        const [firstName, ...lastName] = (o.customer.name || "").trim().split(/\s+/);
        const phone = (o.customer.phone || "").replace(/\D/g, "").replace(/^0/, "92");
        const visitorId = getReplayVisitorId();
        return {
          ...(phone ? { ph: phone } : {}),
          ...(o.customer.email ? { em: o.customer.email.trim().toLowerCase() } : {}),
          ...(firstName ? { fn: firstName.toLowerCase() } : {}),
          ...(lastName.length ? { ln: lastName.join(" ").toLowerCase() } : {}),
          ...(o.customer.city ? { ct: o.customer.city.trim().toLowerCase() } : {}),
          country: "pk",
          ...(visitorId ? { external_id: visitorId } : {}),
        };
      })(),
      onMetaDelivered: () => { try { localStorage.setItem(flag, "1"); } catch {} },
    },
  ).catch(() => undefined);
}

/** ViewContent once per product page. */
export function useViewContent(p: Product | undefined, variantSku?: string | null) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!p) return;
    const sku = p.variants?.options.find((option) => option.sku === variantSku)?.sku || p.sku;
    const key = `${p.id}:${sku}`;
    if (sent.current === key) return;
    sent.current = key;
    trackStoreEvent("ViewContent", {
      content_ids: [sku],
      content_type: "product",
      contents: [{ id: sku, content_id: sku, content_name: p.name, quantity: 1, item_price: p.price }],
      value: p.price,
      currency: "PKR",
    }).catch(() => undefined);
  }, [p, variantSku]);
}

type CheckoutDraft = { name: string; phone: string; email: string; city: string; address: string };

const backendCart = (cart: CartLine[]) =>
  cart.map((l) => {
    const p = getProductById(l.id);
    const variantId = p?.variants?.options.find((o) => o.name === l.variant)?.id;
    return { productId: l.id, variantId, quantity: l.bundle ? Math.max(1, Math.round(l.qty / 2)) : l.qty, bundleSize: l.bundle ? 2 : 1 };
  });

function parseJsonCookie(name: string) {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1);
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * On the checkout page: InitiateCheckout once, and the abandoned-checkout save
 * (POST /api/checkout/abandoned) once a phone or email has been typed, as before.
 */
export function useCheckoutTracking(form: CheckoutDraft) {
  const { cart, ready, payable } = useShop();
  const tracked = useRef(false);
  useEffect(() => {
    if (!ready || !cart.length || tracked.current) return;
    tracked.current = true;
    const contents = cart.map((l) => {
      const p = getProductById(l.id);
      const sku = p?.variants?.options.find((o) => o.name === l.variant)?.sku || p?.sku || l.id;
      return { id: sku, quantity: l.qty, item_price: p ? unitPrice(p, l) : 0 };
    });
    trackStoreEvent("InitiateCheckout", {
      content_ids: contents.map((c) => c.id),
      content_type: "product",
      contents,
      num_items: cart.reduce((sum, l) => sum + l.qty, 0),
      value: payable,
      currency: "PKR",
    }).catch(() => undefined);
  }, [cart, ready, payable]);

  const timer = useRef<number | null>(null);
  useEffect(() => {
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!ready || !cart.length || (phoneDigits.length < 10 && !/^\S+@\S+\.\S+$/.test(form.email.trim()))) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      fetch("/api/store-proxy/api/checkout/abandoned", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          fullName: form.name,
          email: form.email,
          city: form.city,
          address: form.address,
          cart: backendCart(cart),
          source: { replaySessionId: getReplaySessionId(), firstTouch: parseJsonCookie("zm_first_touch"), lastTouch: parseJsonCookie("zm_last_touch") },
        }),
      }).catch(() => undefined);
    }, 2500);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [form.phone, form.name, form.email, form.city, form.address, cart, ready]);
}
