"use client";
import { useEffect, useState } from "react";
import { advanceDiscountFor, amountUntilAdvanceDiscount, resolveAdvancePolicy } from "@zelvomart/delivery";

/**
 * Advance payment (Easypaisa Till / Raast QR). The backend decides whether it is offered (never on the real shop while
 * demo values are saved) and saves the discount; the storefront shows the same number from the same shared rule
 * (packages/delivery), so the total on the button is the total on the order.
 */
export type AdvanceOffer = {
  available: boolean;
  demo?: boolean;
  accountName?: string;
  discount?: number;
  minSubtotal?: number;
};

const OFF: AdvanceOffer = { available: false };

export function useAdvanceOffer() {
  const [offer, setOffer] = useState<AdvanceOffer>(OFF);
  useEffect(() => {
    let active = true;
    fetch("/api/store-proxy/api/payments/advance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : OFF))
      .then((data: AdvanceOffer) => {
        if (active) setOffer(data && data.available ? data : OFF);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return offer;
}

/**
 * The advance discount for a cart: `subtotal` after bundle savings (before coupon), `payable` = subtotal + delivery −
 * coupon. Returns the discount and, below the minimum, how much more to add.
 */
export function advanceQuote(offer: AdvanceOffer, subtotal: number, payable: number) {
  if (!offer.available) return { discount: 0, shortfall: 0, flat: 0 };
  const policy = resolveAdvancePolicy({ discount: offer.discount, minSubtotal: offer.minSubtotal });
  return {
    discount: advanceDiscountFor(subtotal, payable, policy),
    shortfall: amountUntilAdvanceDiscount(subtotal, policy),
    flat: policy.discount,
  };
}
