"use client";

import { useShop } from "@store/lib/store";

export function CartCheckNotice() {
  const { cartCheck, retryCartCheck } = useShop();
  if (cartCheck === "unavailable") {
    return (
      <div role="alert">
        <p>We couldn't check the latest prices and availability. Your cart is still saved.</p>
        <button className="btn secondary" type="button" onClick={retryCartCheck}>Try again</button>
      </div>
    );
  }
  return <p role="status">Checking your saved cart…</p>;
}
