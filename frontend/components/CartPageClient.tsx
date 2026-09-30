"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/Icons";

export default function CartPageClient() {
  const { items, subtotal, bundleSaving, updateQuantity, removeItem } = useCart();

  if (!items.length) return <div className="content-card text-center"><h2>Your cart is empty</h2><p>Add a product to continue.</p><Link className="btn-primary mt-4" href="/shop">Shop products</Link></div>;

  return (
    <div className="grid gap-8 pb-16 lg:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {items.map((item, index) => (
          <div className="grid grid-cols-[86px_1fr] gap-4 border-b border-slate-100 p-4 last:border-0" key={`${item.productId}-${item.variantId || "base"}-${item.bundleSize}`}>
            <div className="relative h-24 overflow-hidden rounded-xl bg-slate-100">{item.image ? <Image src={item.image} alt={item.name} fill className="object-cover" sizes="86px" /> : null}</div>
            <div className="min-w-0">
              <Link href={`/product/${item.slug}/`} className="font-extrabold text-slate-800">{item.name}</Link>
              <div className="mt-1 text-xs text-slate-500">{item.variantLabel || "Standard"}{item.bundleSize === 2 ? " • Buy 2 bundle" : ""}</div>
              <div className="mt-2 font-extrabold">{money(item.price * item.bundleSize * (item.bundleSize === 2 ? 1 - (item.bundleDiscountPercent || 5) / 100 : 1))}</div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="qty-control"><button onClick={() => updateQuantity(index, item.quantity - 1)}><MinusIcon size={14} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(index, item.quantity + 1)}><PlusIcon size={14} /></button></div>
                <button className="remove-line" onClick={() => removeItem(index)}><TrashIcon size={17} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <aside className="summary-card">
        <h3>Cart summary</h3>
        <div className="summary-row"><span>Subtotal</span><b>{money(subtotal)}</b></div>
        {bundleSaving > 0 ? <div className="summary-row"><span>Bundle saving</span><b className="text-emerald-600">-{money(bundleSaving)}</b></div> : null}
        <div className="summary-row"><span>Delivery</span><span>Calculated at checkout</span></div>
        <div className="cod-note">Cash on Delivery • Pay when your parcel arrives</div>
        <Link className="btn-green mt-2 w-full" href="/checkout">Proceed to Checkout</Link>
      </aside>
    </div>
  );
}
