"use client";

import { useEffect } from "react";
import { trackStoreEvent } from "@/lib/client-tracking";

export default function PurchaseClient({ suppressed=false, orderNumber, total, skus, quantities, prices }: { suppressed?:boolean; orderNumber: string; total: number; skus: string[]; quantities: number[]; prices: number[] }) {
  useEffect(() => {
    if(suppressed)return;
    const key = `zm_purchase_fired_${orderNumber}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    trackStoreEvent("Purchase", {
      content_ids: skus,
      content_type: "product",
      contents: skus.map((id, index) => ({
        id,
        content_id: id,
        content_name: id,
        quantity: quantities[index] || 1,
        item_price: prices[index] || 0,
        price: prices[index] || 0,
      })),
      num_items: quantities.reduce((sum, value) => sum + value, 0),
      value: total,
      currency: "PKR",
      order_id: orderNumber,
    }, { eventId: orderNumber }).catch(() => undefined);
  }, [orderNumber, total, skus.join("|"), quantities.join("|"), prices.join("|")]);
  return null;
}
