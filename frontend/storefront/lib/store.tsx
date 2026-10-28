"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getProductById, type Product } from "./catalog";
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
export type CartLine = { key: string; id: string; variant?: string; qty: number; bundle?: number };

/** Price per item for a cart line: the chosen variation's price, with any bundle discount applied. */
export function unitPrice(p: Product, line?: Pick<CartLine, "bundle"> & { variant?: string }) {
  const base = p.variants?.options.find((o) => o.name === line?.variant)?.price ?? p.price;
  return line?.bundle ? Math.round(base * (1 - line.bundle / 100)) : base;
}

/** A cart line in the shape the backend expects (productId, variantId, quantity, bundleSize). */
function backendLine(l: CartLine) {
  const p = getProductById(l.id);
  const variantId = p?.variants?.options.find((o) => o.name === l.variant)?.id;
  const bundleSize = l.bundle ? 2 : 1;
  return { productId: l.id, variantId, quantity: bundleSize === 2 ? Math.max(1, Math.round(l.qty / 2)) : l.qty, bundleSize };
}

function parseJsonCookie(name: string) {
  try {
    const value = readCookie(name);
    return value ? JSON.parse(decodeURIComponent(value)) : null;
  } catch {
    return null;
  }
}

function lineSku(l: CartLine) {
  const p = getProductById(l.id);
  return p?.variants?.options.find((o) => o.name === l.variant)?.sku || p?.sku || l.id;
}
export type Order = {
  /** The order number (ZM-…). */
  id: string;
  /** The private key the confirmation page needs (the backend order id). */
  key?: string;
  createdAt: string;
  lines: (CartLine & { name: string; price: number; image: string })[];
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
  addToCart: (p: Product, opts?: { qty?: number; variant?: string; silent?: boolean; bundle?: number; setQuantity?: boolean }) => void;
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
  const toastId = useRef(0);

  useEffect(() => {
    setCart(read("zlv-cart-v2", []));
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
        const lines: CartLine[] = (data.items || []).map(
          (i: { productId: string; variantId?: string; quantity: number; bundleSize?: number; bundleDiscountPercent?: number }) => {
            const p = getProductById(i.productId);
            const variant = p?.variants?.options.find((o) => o.id === i.variantId)?.name;
            const bundle = i.bundleSize === 2 ? Number(i.bundleDiscountPercent || p?.bundleDiscountPercent || 5) : undefined;
            return { key: i.productId + (variant ? `::${variant}` : "") + (bundle ? "::bundle" : ""), id: i.productId, variant, qty: i.quantity * (i.bundleSize || 1), ...(bundle ? { bundle } : {}) };
          },
        );
        setCart(lines);
        write("zlv-cart-v2", lines);
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
    const qty = opts.qty ?? 1;
    const key = p.id + (opts.variant ? `::${opts.variant}` : "") + (opts.bundle ? "::bundle" : "");
    setCart((lines) => {
      const found = lines.find((l) => l.key === key);
      if (found) return lines.map((l) => (l.key === key ? { ...l, qty: Math.min(99, opts.setQuantity ? qty : l.qty + qty) } : l));
      return [...lines, { key, id: p.id, variant: opts.variant, qty, ...(opts.bundle ? { bundle: opts.bundle } : {}) }];
    });
    if (!opts.silent) setCartOpen(true);
    const option = p.variants?.options.find((o) => o.name === opts.variant);
    const price = unitPrice(p, { bundle: opts.bundle, variant: opts.variant });
    void trackStoreEvent("AddToCart", {
      content_ids: [option?.sku || p.sku],
      content_type: "product",
      contents: [{ id: option?.sku || p.sku, content_id: option?.sku || p.sku, content_name: p.name, quantity: qty, item_price: price }],
      value: price * qty,
      currency: "PKR",
    }).catch(() => undefined);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setCart((lines) =>
      qty <= 0 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? { ...l, qty: Math.min(99, qty) } : l)),
    );
  }, []);

  const removeLine = useCallback((key: string) => setCart((lines) => lines.filter((l) => l.key !== key)), []);
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
        return s + (p ? unitPrice(p, l) : 0) * l.qty;
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
          return p ? { ...l, name: p.name, price: unitPrice(p, l), image: p.image } : null;
        })
        .filter((l): l is NonNullable<typeof l> => !!l);
      requestReplayFlush();
      let idempotencyKey = "";
      try {
        idempotencyKey = sessionStorage.getItem("zm_checkout_idempotency") || crypto.randomUUID();
        sessionStorage.setItem("zm_checkout_idempotency", idempotencyKey);
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
          cart: cart.map(backendLine),
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
      if (!response.ok) throw new Error(String(data.message || data.error || "Could not place order").replace(/_/g, " "));
      requestReplayFlush();
      const sub = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
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
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>");
  return ctx;
}
