"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, ShieldCheck, ShoppingBag, Trash2, X } from "lucide-react";
import { getProductById, products } from "@store/lib/catalog";
import { money } from "@store/lib/format";
import { unitPrice, useShop } from "@store/lib/store";
import { FreeShippingMeter } from "@store/components/shop/FreeShippingMeter";
import { QtyStepper } from "@store/components/shop/QtyStepper";

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, removeLine, subtotal, shipping, total, addToCart, cartCount } = useShop();

  useEffect(() => {
    document.body.classList.toggle("no-scroll", cartOpen);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, setCartOpen]);

  const inCart = new Set(cart.map((l) => l.id));
  const upsell = products.filter((p) => !inCart.has(p.id) && p.price <= 2000).slice(0, 3);

  return (
    <>
      <div className={`drawer-backdrop ${cartOpen ? "show" : ""}`} onClick={() => setCartOpen(false)} aria-hidden="true" />
      <aside className={`side-drawer right cart-drawer ${cartOpen ? "open" : ""}`} aria-label="Shopping cart" aria-hidden={!cartOpen}>
        <div className="drawer-head">
          <h2>
            Your Cart <span>({cartCount})</span>
          </h2>
          <button className="icon-btn" type="button" aria-label="Close cart" onClick={() => setCartOpen(false)}>
            <X size={22} />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="drawer-empty">
            <span className="empty-ico">
              <ShoppingBag size={30} />
            </span>
            <h3>Your cart is empty</h3>
            <p>Find something useful to bring home.</p>
            <Link href="/bestsellers/" className="btn" onClick={() => setCartOpen(false)}>
              Shop bestsellers <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <>
            <div className="drawer-body">
              <FreeShippingMeter subtotal={subtotal} />
              <ul className="mini-lines">
                {cart.map((l) => {
                  const p = getProductById(l.id);
                  if (!p) return null;
                  return (
                    <li key={l.key}>
                      <Link href={`/product/${p.slug}/`} onClick={() => setCartOpen(false)}>
                        <Image src={p.image} alt={p.name} width={76} height={76} />
                      </Link>
                      <div>
                        <Link href={`/product/${p.slug}/`} className="mini-name" onClick={() => setCartOpen(false)}>
                          {p.name}
                        </Link>
                        {l.variant && <small>{l.variant}</small>}
                    {l.bundle && <small>Bundle · {l.bundle}% off</small>}
                        <div className="mini-row">
                          <QtyStepper size="sm" value={l.qty} onChange={(n) => setQty(l.key, n)} />
                          <strong>{money(unitPrice(p, l) * l.qty)}</strong>
                        </div>
                      </div>
                      <button className="icon-btn subtle" type="button" aria-label={`Remove ${p.name}`} onClick={() => removeLine(l.key)}>
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {upsell.length > 0 && (
                <div className="upsell">
                  <p className="drawer-label">Pairs well with</p>
                  {upsell.map((p) => (
                    <div className="upsell-item" key={p.id}>
                      <Image src={p.image} alt="" width={52} height={52} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{money(p.price)}</small>
                      </span>
                      <button type="button" className="pill" onClick={() => addToCart(p, { silent: true })}>
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="drawer-foot">
              <div className="sum-line">
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <div className="sum-line">
                <span>Delivery</span>
                <span>{shipping === 0 ? <b className="free">FREE</b> : money(shipping)}</span>
              </div>
              <div className="sum-line total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>
              <Link href="/checkout/" className="btn block lg" onClick={() => setCartOpen(false)}>
                Checkout <ArrowRight size={17} />
              </Link>
              <Link href="/cart/" className="btn ghost block" onClick={() => setCartOpen(false)}>
                View full cart
              </Link>
              <p className="secure-note">
                <ShieldCheck size={14} /> Pay in cash when your parcel arrives
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
