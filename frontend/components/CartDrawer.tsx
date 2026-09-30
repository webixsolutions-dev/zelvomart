"use client";

import Image from "next/image";
import Link from "next/link";
import { MinusIcon, PlusIcon, TrashIcon, XIcon } from "@/components/Icons";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";

export default function CartDrawer() {
  const { items, subtotal, bundleSaving, open, setOpen, updateQuantity, removeItem } = useCart();

  return (
    <div className={`cart-drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="cart-backdrop" onClick={() => setOpen(false)} aria-label="Close cart" />
      <aside className="cart-panel">
        <div className="cart-head">
          <div>
            <small>Your cart</small>
            <h3>{items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Cart is empty"}</h3>
          </div>
          <button className="icon-square" onClick={() => setOpen(false)} aria-label="Close cart"><XIcon /></button>
        </div>

        <div className="cart-body">
          {!items.length ? (
            <div className="empty-cart">
              <p>Your cart is empty.</p>
              <Link href="/shop" className="btn-primary" onClick={() => setOpen(false)}>Start shopping</Link>
            </div>
          ) : (
            items.map((item, index) => (
              <div className="cart-line" key={`${item.productId}:${item.variantId || "base"}:${item.bundleSize}`}>
                <div className="cart-image">
                  {item.image ? <Image src={item.image} alt={item.name} fill sizes="80px" /> : null}
                </div>
                <div className="cart-line-copy">
                  <Link href={`/product/${item.slug}/`} onClick={() => setOpen(false)}>{item.name}</Link>
                  {item.variantLabel ? <small>{item.variantLabel}</small> : null}
                  {item.bundleSize === 2 ? <small>Bundle: 2 pieces</small> : null}
                  <strong>{money(item.price * item.bundleSize * (item.bundleSize === 2 ? 1 - (item.bundleDiscountPercent || 5) / 100 : 1))}</strong>
                  <div className="cart-line-actions">
                    <div className="qty-control">
                      <button onClick={() => updateQuantity(index, item.quantity - 1)} aria-label="Decrease quantity"><MinusIcon size={14} /></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, item.quantity + 1)} aria-label="Increase quantity"><PlusIcon size={14} /></button>
                    </div>
                    <button className="remove-line" onClick={() => removeItem(index)} aria-label="Remove item"><TrashIcon size={17} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length ? (
          <div className="cart-foot">
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            {bundleSaving > 0 ? <div><span>Bundle saving</span><strong className="text-emerald-600">-{money(bundleSaving)}</strong></div> : null}
            <p>Delivery and final total are recalculated securely at checkout.</p>
            <Link href="/checkout" className="btn-primary" onClick={() => setOpen(false)}>Checkout</Link>
            <Link href="/cart" className="btn-outline" onClick={() => setOpen(false)}>View Cart</Link>
            <button className="continue-link" onClick={() => setOpen(false)}>Continue Shopping</button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
