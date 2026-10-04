"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
};

const CartContext = createContext<CartContextValue | null>(null);
const COOKIE = "zm_cart";

function readCookie() {
  if (typeof document === "undefined") return [] as CartItem[];
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

function writeCookie(items: CartItem[]) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(items))}; Max-Age=2592000; Path=/; SameSite=Lax`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setItems(readCookie()), []);
  useEffect(() => writeCookie(items), [items]);

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
      next[index] = { ...next[index], quantity: Math.min(20, next[index].quantity + item.quantity) };
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

  const clear = useCallback(() => setItems([]), []);

  const bundleSaving = useMemo(
    () =>
      items.reduce((sum, item) => {
        const raw = item.price * item.quantity * item.bundleSize;
        const discount = item.bundleSize === 2 ? raw * ((item.bundleDiscountPercent || 5) / 100) : 0;
        return sum + discount;
      }, 0),
    [items],
  );

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const raw = item.price * item.quantity * item.bundleSize;
        const discount = item.bundleSize === 2 ? raw * ((item.bundleDiscountPercent || 5) / 100) : 0;
        return sum + raw - discount;
      }, 0),
    [items],
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.bundleSize, 0),
    [items],
  );

  const value = useMemo(
    () => ({ items, totalItems, subtotal, bundleSaving, open, setOpen, addItem, updateQuantity, removeItem, clear }),
    [items, totalItems, subtotal, bundleSaving, open, addItem, updateQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
