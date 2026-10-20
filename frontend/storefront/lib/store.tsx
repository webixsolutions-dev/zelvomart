"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getProductById, type Product } from "./catalog";
import { site } from "./site";

/**
 * Client-side shop state (cart, wishlist, orders placed on this device).
 * Persisted to localStorage so the static build behaves like a real store.
 * Replace with API calls once the backend exists — the hook surface can stay the same.
 */

/** `bundle` is the Buy 2 discount (percent) when the line was added as a bundle. */
export type CartLine = { key: string; id: string; variant?: string; qty: number; bundle?: number };

/** Price per item for a cart line, with any bundle discount applied. */
export function unitPrice(p: Product, line?: Pick<CartLine, "bundle">) {
  return line?.bundle ? Math.round(p.price * (1 - line.bundle / 100)) : p.price;
}
export type Order = {
  id: string;
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

/**
 * Live coupon codes. None are running yet, so the list is empty and every code is rejected.
 * When the backend exists, `applyCoupon` calls POST /api/checkout/coupon instead.
 * Example entry: NEXT15: { percent: 15 }  or  WELCOME500: { amount: 500 }
 */
const COUPONS: Record<string, Omit<AppliedCoupon, "code">> = {};

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
  addToCart: (p: Product, opts?: { qty?: number; variant?: string; silent?: boolean; bundle?: number }) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  toggleWish: (id: string) => void;
  isWished: (id: string) => boolean;
  placeOrder: (customer: Order["customer"], opts: { terms: true }) => Order;
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
    setOrders(read("zlv-orders-v1", []));
    setCoupon(read<AppliedCoupon | null>("zlv-coupon-v1", null));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) write("zlv-cart-v2", cart);
  }, [cart, ready]);
  useEffect(() => {
    if (ready) write("zlv-wishlist-v2", wishlist);
  }, [wishlist, ready]);
  useEffect(() => {
    if (ready) write("zlv-orders-v1", orders);
  }, [orders, ready]);
  useEffect(() => {
    if (ready) write("zlv-coupon-v1", coupon);
  }, [coupon, ready]);

  const applyCoupon = useCallback<Ctx["applyCoupon"]>(async (raw) => {
    const code = raw.trim().toUpperCase();
    const rule = COUPONS[code];
    if (!rule) return { ok: false, message: "This code isn't valid or has expired." };
    setCoupon({ code, ...rule });
    return { ok: true, message: `${code} applied.` };
  }, []);
  const removeCoupon = useCallback(() => setCoupon(null), []);

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
      if (found) return lines.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + qty) } : l));
      return [...lines, { key, id: p.id, variant: opts.variant, qty, ...(opts.bundle ? { bundle: opts.bundle } : {}) }];
    });
    if (!opts.silent) setCartOpen(true);
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
      setWishlist((w) => {
        const has = w.includes(id);
        const p = getProductById(id);
        notify({
          title: has ? "Removed from wishlist" : "Saved to wishlist",
          body: p?.name,
          image: p?.image,
        });
        return has ? w.filter((x) => x !== id) : [...w, id];
      });
    },
    [notify],
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
    (customer, opts) => {
      const lines = cart
        .map((l) => {
          const p = getProductById(l.id);
          return p ? { ...l, name: p.name, price: unitPrice(p, l), image: p.image } : null;
        })
        .filter((l): l is NonNullable<typeof l> => !!l);
      const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const ship = shippingFor(sub);
      const off = couponDiscount(coupon, sub);
      const order: Order = {
        id: "ZLV-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 10),
        createdAt: new Date().toISOString(),
        lines,
        subtotal: sub,
        shipping: ship,
        ...(off > 0 && coupon ? { discount: off, coupon: coupon.code } : {}),
        total: sub + ship - off,
        terms: opts.terms,
        customer,
        payment: "cod",
      };
      setOrders((o) => [order, ...o]);
      // Persist immediately so the confirmation page can read it after navigation.
      write("zlv-orders-v1", [order, ...read<Order[]>("zlv-orders-v1", [])]);
      setCart([]);
      setCoupon(null);
      return order;
    },
    [cart, coupon],
  );

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
