"use client";

import { useEffect } from "react";
import { trackStoreEvent } from "@/lib/client-tracking";

export default function PurchaseClient({ orderNumber, total, skus, quantities }: { orderNumber: string; total: number; skus: string[]; quantities: number[] }) {
  useEffect(() => {
    const key = `zm_purchase_fired_${orderNumber}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    trackStoreEvent("Purchase", {
      content_ids: skus,
      contents: skus.map((id, index) => ({ id, quantity: quantities[index] || 1 })),
      num_items: quantities.reduce((sum, value) => sum + value, 0),
      value: total,
      currency: "PKR",
      order_id: orderNumber,
    }, { eventId: orderNumber }).catch(() => undefined);
  }, [orderNumber, total, skus.join("|"), quantities.join("|")]);
  return null;
}
