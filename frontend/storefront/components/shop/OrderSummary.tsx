"use client";

import Image from "next/image";
import { getProductById } from "@store/lib/catalog";
import { money } from "@store/lib/format";
import { bundleLabel, lineTotal, useShop } from "@store/lib/store";
import { CouponBox } from "./CouponBox";

/** Shared totals keep the regular summary and the mobile summary sheet in sync. */
export function OrderSummary({
  advanceDiscount = 0,
  items = true,
}: {
  advanceDiscount?: number;
  items?: boolean;
}) {
  const { cart, subtotal, shipping, payable, coupon, discount } = useShop();
  return (
    <>
      {items && (
        <ul className="sum-items">
          {cart.map((line) => {
            const product = getProductById(line.id);
            if (!product) return null;
            return (
              <li key={line.key}>
                <span className="sum-thumb">
                  <Image src={product.image} alt="" width={48} height={48} />
                  <b>{line.qty}</b>
                </span>
                <span>
                  <strong>{product.name}</strong>
                  {line.variant && <small>{line.variant}</small>}
                  {line.bundle && <small>{bundleLabel(line.qty)}</small>}
                </span>
                <strong>{money(lineTotal(product, line))}</strong>
              </li>
            );
          })}
        </ul>
      )}
      <div className="sum-line">
        <span>Subtotal</span>
        <strong>{money(subtotal)}</strong>
      </div>
      <div className="sum-line">
        <span>Delivery</span>
        <strong>
          {shipping === 0 ? (
            <span className="free">FREE</span>
          ) : (
            money(shipping)
          )}
        </strong>
      </div>
      {coupon && discount > 0 && (
        <div className="sum-line discount">
          <span>Coupon {coupon.code}</span>
          <strong>−{money(discount)}</strong>
        </div>
      )}
      {advanceDiscount > 0 && (
        <div className="sum-line discount">
          <span>Advance payment saving</span>
          <strong>−{money(advanceDiscount)}</strong>
        </div>
      )}
      <div className="sum-line total">
        <span>Total (PKR)</span>
        <strong>{money(payable - advanceDiscount)}</strong>
      </div>
      <CouponBox />
    </>
  );
}
