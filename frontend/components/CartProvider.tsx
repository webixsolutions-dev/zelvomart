"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bundleLineTotal, BUY_TWO_DISCOUNT_PERCENT } from "@/lib/bundle-price";

export type CartItem = {
  productId: string;
  variantId?: string | null;
  sku?: string;
  slug: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  bundleSize: 1 | 2;
  bundleDiscountPercent?: number;
  variantLabel?: string;
  freeShipping?: boolean;
};

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  bundleSaving: number;
  open: boolean;
  setOpen: (value: boolean) => void;
  addItem: (item: CartItem) => void;
  updateQuantity: (index: number, quantity: number) => void;
  removeItem: (index: number) => void;
  clear: () => void;
  ready: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const COOKIE = "zm_cart";

// Cookies cap out near 4 KB, so a larger cart is kept in localStorage as well.
function readStorage() {
  try {
    const raw = window.localStorage.getItem(COOKIE);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as CartItem[]) : null;
  } catch {
    return null;
  }
}

function readCookie() {
  if (typeof document === "undefined") return [] as CartItem[];
  const stored = readStorage();
  if (stored) return stored;
  const row = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE}=`));
  if (!row) return [];
  try {
    return JSON.parse(decodeURIComponent(row.slice(COOKIE.length + 1))) as CartItem[];
  } catch {
    return [];
  }
}

export function writeCartCookie(items: CartItem[]) {
  if (typeof document === "undefined") return;
  try {
    window.localStorage.setItem(COOKIE, JSON.stringify(items));
  } catch {}
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(items))}; Max-Age=2592000; Path=/; SameSite=Lax`;
}


export function clearPersistedCart() {
  writeCartCookie([]);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readCookie());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeCartCookie(items);
  }, [items, ready]);

  useEffect(()=>{if(!ready||!items.length)return;const timer=setTimeout(()=>{void fetch('/api/account/cart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cart:items.map(i=>({productId:i.productId,variantId:i.variantId,quantity:i.quantity,bundleSize:i.bundleSize})),source:{page:location.pathname}})}).catch(()=>undefined)},1800);return()=>clearTimeout(timer)},[items,ready]);
  useEffect(()=>{const token=new URLSearchParams(location.search).get('restore');if(!token||location.pathname!=='/cart')return;const controller=new AbortController();void fetch('/api/store-proxy/api/recovery/restore/'+encodeURIComponent(token),{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);if(controller.signal.aborted)return;setItems(data.items);writeCartCookie(data.items);setReady(true);const coupon=new URLSearchParams(location.search).get('coupon');if(coupon)sessionStorage.setItem('zm_checkout_coupon',coupon);location.assign('/checkout'+(coupon?'?coupon='+encodeURIComponent(coupon):''));}).catch(()=>undefined);return()=>controller.abort()},[]);

  const addItem = useCallback((item: CartItem) => {
    setItems((current) => {
      const index = current.findIndex(
        (row) =>
          row.productId === item.productId &&
          row.variantId === item.variantId &&
          row.bundleSize === item.bundleSize,
      );
      if (index === -1) return [...current, item];
      const next = [...current];
      next[index] = {
        ...next[index],
        quantity: Math.min(20, next[index].quantity + item.quantity),
        freeShipping: Boolean(item.freeShipping),
      };
      return next;
    });
    setOpen(true);
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    setItems((current) =>
      current
        .map((item, itemIndex) =>
          itemIndex === index ? { ...item, quantity: Math.max(1, Math.min(20, quantity)) } : item,
        )
        .filter(Boolean),
    );
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setOpen(false);
  }, []);

  const pricedItems = useMemo(
    () => items.map((item) => bundleLineTotal(item.price, item.quantity, item.bundleSize, BUY_TWO_DISCOUNT_PERCENT)),
    [items],
  );

  const bundleSaving = useMemo(
    () => pricedItems.reduce((sum, item) => sum + item.saving, 0),
    [pricedItems],
  );

  const subtotal = useMemo(
    () => pricedItems.reduce((sum, item) => sum + item.total, 0),
    [pricedItems],
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.bundleSize, 0),
    [items],
  );

  const value = useMemo(
    () => ({ items, totalItems, subtotal, bundleSaving, open, setOpen, addItem, updateQuantity, removeItem, clear, ready }),
    [items, totalItems, subtotal, bundleSaving, open, addItem, updateQuantity, removeItem, clear, ready],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
