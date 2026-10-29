"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getProductById, type Product, type Variant } from "./catalog";
import { site } from "./site";
import { trackStoreEvent, readCookie } from "@/lib/client-tracking";
import { getReplaySessionId, getReplayVisitorId, requestReplayFlush } from "@/lib/session-replay-client";

/**
 * Shop state. The cart and wishlist stay on the device (as before) and every cart change is
 * synced to the backend (/api/account/cart). Coupons, orders, the confirmation page and the
 * restore link all use the backend through /api/store-proxy, with the same request bodies the
 * previous storefront sent (CheckoutClient, CartProvider, PurchaseClient).
 */

/** `bundle` is the Buy 2 discount (percent) when the line was added as a bundle. */

/** sessionStorage: the order just placed, so the thank-you page renders it before the backend answers. */
export const PLACED_ORDER_KEY = "zm_placed_order";
/**
 * One cart line. `qty` is always in pieces. A bundle line (`bundle` = the Buy 2 discount in percent) holds
 * whole bundles only, so its `qty` is 2, 4, 6 … and the API receives `qty / 2` bundles of size 2.
 * `variantId` is the variation's stable id; `variant` is its name, kept for display only.
 */
export type CartLine = { key: string; id: string; variantId?: string; variant?: string; qty: number; bundle?: number };

/** Most pieces one cart line may hold (10 bundles = 20 pieces). The API checks the same number (backend validators.ts). */
export const MAX_LINE_PIECES = 20;
/** Pieces in one Buy 2 bundle. */
export const BUNDLE_PIECES = 2;

/** Variant and bundle on one line: "Purple · 1 bundle (2 pcs) · 5% off". */
export function lineDetail(line: Pick<CartLine, "variant" | "bundle" | "qty">) {
  return [line.variant, line.bundle ? `${bundleLabel(line.qty)} · ${line.bundle}% off` : ""].filter(Boolean).join(" · ");
}

/** What one bundle costs (2 pcs, discount taken off, rounded like the server); for "per bundle" prices. */
export function bundlePrice(p: Product, line: Pick<CartLine, "bundle" | "variantId" | "variant">) {
  return lineTotal(p, { ...line, qty: BUNDLE_PIECES });
}

/** "1 bundle (2 pcs)", "3 bundles (6 pcs)". */
export function bundleLabel(pieces: number) {
  const bundles = Math.ceil(pieces / BUNDLE_PIECES);
  return `${bundles} bundle${bundles === 1 ? "" : "s"} (${pieces} pcs)`;
}

/** The variation a line (or a selection) points at: by id when there is one, otherwise by name (older carts). */
export function findVariant(p: Product, line?: { variantId?: string; variant?: string }): Variant | undefined {
  const options = p.variants?.options ?? [];
  if (line?.variantId) return options.find((o) => o.id === line.variantId);
  if (line?.variant) return options.find((o) => o.name === line.variant);
  return undefined;
}

export function lineKey(productId: string, option?: Pick<Variant, "id" | "name">, bundle?: number) {
  const variantPart = option ? `::${option.id || option.name}` : "";
  return productId + variantPart + (bundle ? "::bundle" : "");
}

/** Base price per piece: the chosen variation's price, else the product's. */
function basePrice(p: Product, line?: { variantId?: string; variant?: string }) {
  return findVariant(p, line)?.price ?? p.price;
}

/** Price per piece for display ("Rs 950 each"), with any bundle discount applied. */
export function unitPrice(p: Product, line?: Pick<CartLine, "bundle" | "variantId" | "variant">) {
  const base = basePrice(p, line);
  return line?.bundle ? Math.round(base * (1 - line.bundle / 100)) : base;
}

/** What a line costs. Same rounding as the server (bundleLineTotal): the discount is taken off the whole line, then rounded. */
export function lineTotal(p: Product, line: Pick<CartLine, "bundle" | "variantId" | "variant" | "qty">) {
  const full = basePrice(p, line) * line.qty;
  return line.bundle ? Math.round(full * (1 - line.bundle / 100)) : full;
}

/** A cart line in the shape the backend expects (productId, variantId, quantity, bundleSize). */
function backendLine(l: CartLine) {
  const p = getProductById(l.id);
  const variantId = (p && findVariant(p, l)?.id) || l.variantId;
  if (l.bundle) return { productId: l.id, variantId, quantity: Math.max(1, Math.ceil(l.qty / BUNDLE_PIECES)), bundleSize: 2 as const };
  return { productId: l.id, variantId, quantity: l.qty, bundleSize: 1 as const };
}
export { backendLine as cartLineForApi };

/**
 * Brings a stored or restored line up to the current rules: variant resolved to its id, bundle quantity in whole
 * bundles (odd counts rounded up), at most MAX_LINE_PIECES, sold-out items taken out. Every change returns a note
 * the customer sees before checkout — nothing is changed silently.
 */
function normalizeLine(l: CartLine): { line: CartLine | null; note?: string } {
  const p = getProductById(l.id);
  if (!p) return { line: l };
  const option = findVariant(p, l);
  const label = p.name + (option ? ` (${option.name})` : l.variant ? ` (${l.variant})` : "");
  if (p.inStock === false || option?.soldOut) return { line: null, note: `${label} is sold out, so it was taken out of your cart.` };
  let qty = Math.max(1, Math.floor(Number(l.qty) || 1));
  const notes: string[] = [];
  if (l.bundle && qty % BUNDLE_PIECES) {
    qty += BUNDLE_PIECES - (qty % BUNDLE_PIECES);
    notes.push(`${label} is sold in bundles of 2, so the quantity is now ${bundleLabel(qty)}.`);
  }
  if (qty > MAX_LINE_PIECES) {
    qty = MAX_LINE_PIECES;
    notes.push(`${label}: the most you can order is ${MAX_LINE_PIECES} pcs per item, so the quantity is now ${MAX_LINE_PIECES}.`);
  }
  const variantId = option?.id ?? l.variantId;
  const variant = option?.name ?? l.variant;
  const key = lineKey(l.id, option ?? (variantId || variant ? { id: variantId, name: variant || "" } : undefined), l.bundle);
  return { line: { key, id: l.id, ...(variantId ? { variantId } : {}), ...(variant ? { variant } : {}), qty, ...(l.bundle ? { bundle: l.bundle } : {}) }, note: notes.join(" ") || undefined };
}

/** Normalizes every line and merges lines that now share a key. */
function normalizeCart(lines: CartLine[]): { cart: CartLine[]; notes: string[] } {
  const notes: string[] = [];
  const out: CartLine[] = [];
  for (const raw of Array.isArray(lines) ? lines : []) {
    if (!raw || typeof raw.id !== "string") continue;
    const { line, note } = normalizeLine(raw);
    if (note) notes.push(note);
    if (!line) continue;
    const same = out.find((l) => l.key === line.key);
    if (!same) out.push(line);
    else if (same.qty + line.qty > MAX_LINE_PIECES) {
      same.qty = MAX_LINE_PIECES;
      notes.push(`The most you can order is ${MAX_LINE_PIECES} pcs per item, so a repeated item was reduced to ${MAX_LINE_PIECES}.`);
    } else same.qty += line.qty;
  }
  return { cart: out, notes };
}

function parseJsonCookie(name: string) {
  try {
    const value = readCookie(name);
    return value ? JSON.parse(decodeURIComponent(value)) : null;
  } catch {
    return null;
  }
}

/** The SKU sent to Meta/TikTok as content_id: the variation's SKU, else the product's. */
export function lineSku(l: Pick<CartLine, "id" | "variantId" | "variant">) {
  const p = getProductById(l.id);
  return (p && findVariant(p, l)?.sku) || p?.sku || l.id;
}
export type Order = {
  /** The order number (ZM-…). */
  id: string;
  /** The private key the confirmation page needs (the backend order id). */
  key?: string;
  createdAt: string;
  /** `price` is per piece (for display); `lineTotal` is what the line costs, rounded like the server. */
  lines: (CartLine & { name: string; price: number; lineTotal?: number; image: string })[];
  subtotal: number;
  shipping: number;
  /** Coupon discount taken off the subtotal (0 / absent when no coupon). */
  discount?: number;
  coupon?: string;
  total: number;
  /** Customer ticked “I agree to the Terms & Conditions…” — required for storefront orders. */
  terms?: boolean;
  customer: { name: string; phone: string; email?: string; city: string; address: string; notes?: string };
  payment: "cod";
};

/** Shown when checkout answers 429: never a raw error, always a way to finish the order on WhatsApp. */
export const CHECKOUT_RATE_LIMIT_MESSAGE =
  "Bohot zyada koshishen hui hain. 2 minute baad dobara try karein ya WhatsApp par order karein.";
export class CheckoutRateLimited extends Error {
  constructor() {
    super(CHECKOUT_RATE_LIMIT_MESSAGE);
    this.name = "CheckoutRateLimited";
  }
}

/** A coupon the customer has applied; kept on the device so it follows them from cart to checkout. */
export type AppliedCoupon = { code: string; percent?: number; amount?: number };

export function couponDiscount(coupon: AppliedCoupon | null, subtotal: number) {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.percent) return Math.min(subtotal, Math.round((subtotal * coupon.percent) / 100));
  if (coupon.amount) return Math.min(subtotal, coupon.amount);
  return 0;
}

type Toast = { id: number; title: string; body?: string; image?: string };

type Ctx = {
  ready: boolean;
  cart: CartLine[];
  wishlist: string[];
  orders: Order[];
  cartCount: number;
  subtotal: number;
  /** Decided on the subtotal before any coupon. */
  shipping: number;
  /** Subtotal + delivery, before coupon (the mini cart shows this). */
  total: number;
  coupon: AppliedCoupon | null;
  discount: number;
  /** What the customer pays: subtotal + delivery − coupon. */
  payable: number;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
  removeCoupon: () => void;
  /**
   * Adds a product. `variantId` (or `variant` name for options without an id) picks the variation; without one the
   * first in-stock variation is used. Sold-out items are not added. `qty` is in pieces. Returns false when nothing was added.
   */
  addToCart: (p: Product, opts?: { qty?: number; variantId?: string; variant?: string; silent?: boolean; bundle?: number; setQuantity?: boolean }) => boolean;
  /** Changes about the cart the customer must see (rounded bundles, the 20 pcs limit, sold-out items taken out). */
  cartNotes: string[];
  dismissCartNotes: () => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  toggleWish: (id: string) => void;
  isWished: (id: string) => boolean;
  /** Places the order on the backend (POST /api/orders) and returns it with the real order number. */
  placeOrder: (customer: Order["customer"], opts: { terms: true }) => Promise<Order>;
  completeOrder: () => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  toasts: Toast[];
  notify: (t: Omit<Toast, "id">) => void;
};

const ShopContext = createContext<Ctx | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — state still works for the session */
  }
}

export function shippingFor(subtotal: number) {
  if (subtotal === 0) return 0;
  return subtotal >= site.shipping.freeOver ? 0 : site.shipping.flatFee;
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cartNotes, setCartNotes] = useState<string[]>([]);
  const toastId = useRef(0);
  const addNotes = useCallback((notes: string[]) => {
    if (notes.length) setCartNotes((all) => [...new Set([...all, ...notes])].slice(-6));
  }, []);
  const dismissCartNotes = useCallback(() => setCartNotes([]), []);

  useEffect(() => {
    // Older carts kept the variant name and any bundle quantity; they are brought up to the current rules once, with a note.
    const loaded = normalizeCart(read<CartLine[]>("zlv-cart-v2", []));
    setCart(loaded.cart);
    if (loaded.notes.length) setCartNotes(loaded.notes);
    setWishlist(read("zlv-wishlist-v2", []));
    setCoupon(read<AppliedCoupon | null>("zlv-coupon-v1", null));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) write("zlv-cart-v2", cart);
  }, [cart, ready]);
  useEffect(() => {
    if (ready) write("zlv-wishlist-v2", wishlist);
  }, [wishlist, ready]);
  // Every cart change is synced to the backend (account cart / abandoned-cart recovery), as before.
  useEffect(() => {
    if (!ready || !cart.length) return;
    const timer = setTimeout(() => {
      void fetch("/api/account/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart: cart.map(backendLine), source: { page: location.pathname } }),
      }).catch(() => undefined);
    }, 1800);
    return () => clearTimeout(timer);
  }, [cart, ready]);

  // Recovery link from the abandoned-cart message: /cart/?restore=<token>[&coupon=CODE]
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("restore");
    if (!token || location.pathname.replace(/\/+$/, "") !== "/cart") return;
    const controller = new AbortController();
    void fetch("/api/store-proxy/api/recovery/restore/" + encodeURIComponent(token), { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || controller.signal.aborted) return;
        const restored: CartLine[] = (data.items || []).map(
          (i: { productId: string; variantId?: string; quantity: number; bundleSize?: number; bundleDiscountPercent?: number }) => {
            const p = getProductById(i.productId);
            const bundle = i.bundleSize === 2 ? Number(i.bundleDiscountPercent || p?.bundleDiscountPercent || 5) : undefined;
            const qty = Number(i.quantity) * (i.bundleSize === 2 ? BUNDLE_PIECES : 1);
            return { key: "", id: i.productId, ...(i.variantId ? { variantId: i.variantId } : {}), qty, ...(bundle ? { bundle } : {}) };
          },
        );
        const { cart: lines, notes } = normalizeCart(restored);
        setCart(lines);
        write("zlv-cart-v2", lines);
        // The checkout page shows these notes before the order is placed.
        if (notes.length) sessionStorage.setItem("zm_cart_notes", JSON.stringify(notes));
        const code = params.get("coupon");
        if (code) sessionStorage.setItem("zm_checkout_coupon", code);
        location.assign("/checkout/" + (code ? "?coupon=" + encodeURIComponent(code) : ""));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (ready) write("zlv-coupon-v1", coupon);
  }, [coupon, ready]);

  const cartRef = useRef(cart);
  cartRef.current = cart;
  // POST /api/checkout/coupon prices the coupon on the real cart; the discount it returns is what we show.
  const applyCoupon = useCallback<Ctx["applyCoupon"]>(async (raw) => {
    const code = raw.trim().toUpperCase();
    if (!code) return { ok: false, message: "Enter a coupon code." };
    try {
      const response = await fetch("/api/store-proxy/api/checkout/coupon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, cart: cartRef.current.map(backendLine) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, message: "This code isn't valid or has expired." };
      const applied = { code: String(data.code || code), amount: Number(data.discount || 0) };
      setCoupon(applied);
      try {
        sessionStorage.setItem("zm_checkout_coupon", applied.code);
      } catch {}
      return { ok: true, message: `${applied.code} applied.` };
    } catch {
      return { ok: false, message: "We couldn't check that code right now. Please try again." };
    }
  }, []);
  const removeCoupon = useCallback(() => {
    setCoupon(null);
    try {
      sessionStorage.removeItem("zm_checkout_coupon");
    } catch {}
  }, []);

  // The coupon's amount depends on the cart, so it is re-priced whenever the cart changes.
  const cartSignature = JSON.stringify(cart.map(backendLine));
  const couponCode = coupon?.code;
  useEffect(() => {
    if (!ready || !couponCode) return;
    if (!cart.length) return;
    void applyCoupon(couponCode).then((r) => {
      if (!r.ok) setCoupon(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature, ready]);

  const notify = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 3200);
  }, []);

  const addToCart = useCallback<Ctx["addToCart"]>((p, opts = {}) => {
    const options = p.variants?.options ?? [];
    const option = opts.variantId || opts.variant ? findVariant(p, opts) : options.find((o) => !o.soldOut);
    if (p.inStock === false || (options.length && (!option || option.soldOut))) {
      notify({ title: "Sold out", body: p.name + (option ? ` (${option.name})` : ""), image: p.image });
      return false;
    }
    const bundle = opts.bundle && p.bundleEnabled ? opts.bundle : undefined;
    let qty = Math.max(1, Math.floor(opts.qty ?? (bundle ? BUNDLE_PIECES : 1)));
    if (bundle && qty % BUNDLE_PIECES) qty += BUNDLE_PIECES - (qty % BUNDLE_PIECES);
    const key = lineKey(p.id, option, bundle);
    const current = cartRef.current.find((l) => l.key === key)?.qty ?? 0;
    const wanted = opts.setQuantity ? qty : current + qty;
    const next = Math.min(MAX_LINE_PIECES, wanted);
    if (wanted > MAX_LINE_PIECES) addNotes([`The most you can order is ${MAX_LINE_PIECES} pcs per item. ${p.name} is at ${MAX_LINE_PIECES}.`]);
    const added = next - (opts.setQuantity ? 0 : current);
    setCart((lines) => {
      const found = lines.find((l) => l.key === key);
      const q = Math.min(MAX_LINE_PIECES, opts.setQuantity ? qty : (found?.qty ?? 0) + qty);
      if (found) return lines.map((l) => (l.key === key ? { ...l, qty: q } : l));
      return [...lines, { key, id: p.id, ...(option?.id ? { variantId: option.id } : {}), ...(option ? { variant: option.name } : {}), qty: q, ...(bundle ? { bundle } : {}) }];
    });
    if (!opts.silent) setCartOpen(true);
    const pieces = Math.max(added, 0) || next;
    const sku = option?.sku || p.sku;
    const value = lineTotal(p, { variantId: option?.id, variant: option?.name, bundle, qty: pieces });
    void trackStoreEvent("AddToCart", {
      content_ids: [sku],
      content_type: "product",
      contents: [{ id: sku, content_id: sku, content_name: p.name, quantity: pieces, item_price: unitPrice(p, { variantId: option?.id, variant: option?.name, bundle }) }],
      value,
      currency: "PKR",
    }).catch(() => undefined);
    return true;
  }, [addNotes, notify]);

  const setQty = useCallback((key: string, qty: number) => {
    const line = cartRef.current.find((l) => l.key === key);
    if (!line) return;
    if (qty <= 0) return setCart((lines) => lines.filter((l) => l.key !== key));
    let next = Math.floor(qty);
    // Bundle lines move one whole bundle at a time.
    if (line.bundle && next % BUNDLE_PIECES) next += BUNDLE_PIECES - (next % BUNDLE_PIECES);
    if (next > MAX_LINE_PIECES) {
      next = MAX_LINE_PIECES;
      addNotes([`The most you can order is ${MAX_LINE_PIECES} pcs per item.`]);
    }
    setCart((lines) => lines.map((l) => (l.key === key ? { ...l, qty: next } : l)));
  }, [addNotes]);

  const removeLine = useCallback((key: string) => setCart((lines) => lines.filter((l) => l.key !== key)), []);

  // Notes saved by the restore link (it redirects to checkout before they can be shown).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("zm_cart_notes");
      if (saved) {
        sessionStorage.removeItem("zm_cart_notes");
        addNotes(JSON.parse(saved));
      }
    } catch {}
  }, [addNotes]);
  const clearCart = useCallback(() => setCart([]), []);

  const toggleWish = useCallback(
    (id: string) => {
      const has = wishlist.includes(id);
      setWishlist((w) => {
        // Keep this updater pure: React Strict Mode may invoke state updaters twice in development.
        return has ? w.filter((x) => x !== id) : w.includes(id) ? w : [...w, id];
      });
      const p = getProductById(id);
      notify({
        title: has ? "Removed from wishlist" : "Saved to wishlist",
        body: p?.name,
        image: p?.image,
      });
    },
    [notify, wishlist],
  );

  const subtotal = useMemo(
    () =>
      cart.reduce((s, l) => {
        const p = getProductById(l.id);
        return s + (p ? lineTotal(p, l) : 0);
      }, 0),
    [cart],
  );
  const shipping = shippingFor(subtotal);
  const discount = couponDiscount(coupon, subtotal);

  const placeOrder = useCallback<Ctx["placeOrder"]>(
    async (customer, opts) => {
      const lines = cart
        .map((l) => {
          const p = getProductById(l.id);
          return p ? { ...l, name: p.name, price: unitPrice(p, l), lineTotal: lineTotal(p, l), image: p.image } : null;
        })
        .filter((l): l is NonNullable<typeof l> => !!l);
      requestReplayFlush();
      // A retry of the same cart reuses its key (no double order); a changed cart gets a new key, so the
      // server never answers with an earlier order for different items.
      const apiCart = cart.map(backendLine);
      const signature = JSON.stringify([apiCart, coupon?.code || ""]);
      let idempotencyKey = "";
      try {
        let saved: { key?: string; cart?: string } | null = null;
        try {
          saved = JSON.parse(sessionStorage.getItem("zm_checkout_idempotency") || "null");
        } catch {
          /* older format (a bare key): start a new one */
        }
        idempotencyKey = saved?.cart === signature && saved.key ? saved.key : crypto.randomUUID();
        sessionStorage.setItem("zm_checkout_idempotency", JSON.stringify({ key: idempotencyKey, cart: signature }));
      } catch {
        idempotencyKey = crypto.randomUUID();
      }
      // Same body the previous checkout sent, so the backend, pixels and replays see no change.
      const response = await fetch("/api/store-proxy/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          couponCode: coupon?.code,
          fullName: customer.name,
          phone: customer.phone,
          email: customer.email || "",
          city: customer.city,
          address: customer.address,
          orderNotes: customer.notes || "",
          terms: opts.terms,
          paymentMethod: "COD",
          honeypot: "",
          cart: apiCart,
          source: { firstTouch: parseJsonCookie("zm_first_touch"), lastTouch: parseJsonCookie("zm_last_touch"), ...(parseJsonCookie("zm_last_touch") || {}) },
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
          ttp: readCookie("_ttp"),
          ttclid: readCookie("ttclid"),
          visitorId: getReplayVisitorId(),
          replaySessionId: getReplaySessionId(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 429) throw new CheckoutRateLimited();
      if (!response.ok) throw new Error(String(data.message || data.error || "Could not place order").replace(/_/g, " "));
      requestReplayFlush();
      const sub = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const order: Order = {
        id: String(data.orderNumber),
        key: String(data.id),
        createdAt: new Date().toISOString(),
        lines,
        subtotal: Number(data.subtotal ?? sub),
        shipping: Number(data.deliveryFee ?? shippingFor(sub)),
        ...(coupon ? { discount: Number(data.discount ?? discount), coupon: coupon.code } : {}),
        total: Number(data.total ?? sub + shippingFor(sub) - discount),
        terms: opts.terms,
        customer,
        payment: "cod",
      };
      // The cart stays as it is until the thank-you page has mounted (completeOrder), so the checkout never
      // re-renders from an empty cart (Rs 0 / free delivery) while the next page loads. The thank-you page
      // shows this copy at once and refreshes it from the backend.
      try {
        sessionStorage.setItem(PLACED_ORDER_KEY, JSON.stringify(order));
      } catch {}
      return order;
    },
    [cart, coupon, discount],
  );

  /** Called by the thank-you page once it shows the order: empties the cart and forgets the checkout's coupon and key. */
  const completeOrder = useCallback(() => {
    setCart([]);
    write("zlv-cart-v2", []);
    setCoupon(null);
    setCartNotes([]);
    try {
      sessionStorage.removeItem("zm_checkout_idempotency");
      sessionStorage.removeItem("zm_checkout_coupon");
    } catch {}
  }, []);

  const value: Ctx = {
    ready,
    cart,
    wishlist,
    orders,
    cartCount: cart.reduce((s, l) => s + l.qty, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
    coupon,
    discount,
    payable: subtotal + shipping - discount,
    applyCoupon,
    removeCoupon,
    addToCart,
    setQty,
    removeLine,
    clearCart,
    toggleWish,
    isWished: (id) => wishlist.includes(id),
    placeOrder,
    completeOrder,
    cartOpen,
    setCartOpen,
    toasts,
    notify,
    cartNotes,
    dismissCartNotes,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>");
  return ctx;
}
