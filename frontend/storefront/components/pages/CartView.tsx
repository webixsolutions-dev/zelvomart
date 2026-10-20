"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Banknote, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { categoryPath, getCategory, getProductById, products } from "@store/lib/catalog";
import { money } from "@store/lib/format";
import { unitPrice, useShop } from "@store/lib/store";
import { FreeShippingMeter } from "@store/components/shop/FreeShippingMeter";
import { QtyStepper } from "@store/components/shop/QtyStepper";
import { CouponBox } from "@store/components/shop/CouponBox";
import { ProductGrid } from "@store/components/product/ProductGrid";
import { SectionHead } from "@store/components/ui/SectionHead";
import { PageIntro } from "@store/components/home/Blocks";

/** Next steps offered on the empty cart. */
const emptyCategories = ["home-living", "beauty", "tech", "kids"];

export function CartView() {
  const { cart, ready, setQty, removeLine, subtotal, shipping, coupon, discount, payable, clearCart } = useShop();
  const inCart = new Set(cart.map((l) => l.id));
  const suggestions = products.filter((p) => !inCart.has(p.id) && p.isBestseller).slice(0, 4);

  if (!ready) return <div className="container skeleton-block" />;

  return (
    <>
      {cart.length > 0 && (
        <PageIntro eyebrow="Shopping bag" title="Your Cart" sub="Review your items — delivery and total are shown before you confirm." />
      )}
      <section className={`section pt-sm${cart.length === 0 ? " cart-empty-section" : ""}`}>
        <div className="container">
          {cart.length === 0 ? (
            <div className="empty-state cart-empty">
              <span className="empty-ico">
                <ShoppingBag size={30} />
              </span>
              <h1>Your cart is empty</h1>
              <p>Your next useful find is waiting.</p>
              <Link href="/shop-all-products/" className="btn lg">
                Start shopping <ArrowRight size={16} />
              </Link>
              <ul className="cart-empty-chips" aria-label="Shop by category">
                {emptyCategories.map((id) => {
                  const c = getCategory(id);
                  return c ? (
                    <li key={id}>
                      <Link href={categoryPath(id)}>{c.name}</Link>
                    </li>
                  ) : null;
                })}
              </ul>
              <Link href="/bestsellers/" className="cart-empty-best">
                Or see our bestsellers <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="checkout-grid">
              <div>
                <FreeShippingMeter subtotal={subtotal} />
                <div className="cart-table">
                  <div className="cart-head">
                    <span>Product</span>
                    <span>Quantity</span>
                    <span>Total</span>
                  </div>
                  {cart.map((l) => {
                    const p = getProductById(l.id);
                    if (!p) return null;
                    return (
                      <div className="cart-row" key={l.key}>
                        <Link href={`/product/${p.slug}/`} className="cart-prod">
                          <Image src={p.image} alt={p.name} width={88} height={88} />
                          <span>
                            <small>{getCategory(p.category)?.short}</small>
                            <strong>{p.name}</strong>
                            {l.variant && <em>{l.variant}</em>}
                            {l.bundle && <em>Bundle · {l.bundle}% off</em>}
                            <span className="unit">{money(unitPrice(p, l))} each</span>
                          </span>
                        </Link>
                        <QtyStepper size="sm" value={l.qty} onChange={(n) => setQty(l.key, n)} />
                        <strong className="line-total">{money(unitPrice(p, l) * l.qty)}</strong>
                        <button className="icon-btn subtle" type="button" aria-label={`Remove ${p.name}`} onClick={() => removeLine(l.key)}>
                          <Trash2 size={17} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="cart-under">
                  <Link href="/shop-all-products/" className="link-cta">
                    ← Continue shopping
                  </Link>
                  <button type="button" className="link-btn" onClick={clearCart}>
                    Clear cart
                  </button>
                </div>
              </div>
              <aside className="summary-box">
                <h3>Order Summary</h3>
                <div className="sum-line">
                  <span>Subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </div>
                <div className="sum-line">
                  <span>Delivery</span>
                  <span>{shipping === 0 ? <b className="free">FREE</b> : money(shipping)}</span>
                </div>
                {coupon && discount > 0 && (
                  <div className="sum-line discount">
                    <span>Coupon {coupon.code}</span>
                    <strong>−{money(discount)}</strong>
                  </div>
                )}
                <div className="sum-line total">
                  <span>Total</span>
                  <strong>{money(payable)}</strong>
                </div>
                <CouponBox />
                <Link className="btn block lg" href="/checkout/">
                  Proceed to Checkout <ArrowRight size={17} />
                </Link>
                <ul className="summary-assure">
                  <li>
                    <Banknote size={16} /> Cash on Delivery — pay at your door
                  </li>
                  <li>
                    <ShieldCheck size={16} /> Order confirmed by our team before dispatch
                  </li>
                </ul>
              </aside>
            </div>
          )}
        </div>
      </section>
      {suggestions.length > 0 && (
        <section className="section section-soft">
          <div className="container">
            <SectionHead eyebrow="Before you go" title="Customers also bought" href="/bestsellers/" linkLabel="Bestsellers" />
            <ProductGrid items={suggestions} />
          </div>
        </section>
      )}
    </>
  );
}
