"use client";

interface StockBadgeProps {
  /** "instock" | "outofstock" from the API (the shared stock rule). */
  stockStatus?: string;
  /** Live tracked quantity; null when stock is not tracked. */
  stockQuantity?: number | null;
}

export function stockBadgeState(stockStatus?: string, stockQuantity?: number | null) {
  if (stockStatus === "outofstock") return { variant: "out", label: "Out of stock" };
  if (stockQuantity != null && stockQuantity <= 5) return { variant: "low", label: `Low stock (${stockQuantity})` };
  return { variant: "in", label: stockQuantity != null ? `In stock (${stockQuantity})` : "In stock" };
}

export default function StockBadge({ stockStatus, stockQuantity }: StockBadgeProps) {
  const { variant, label } = stockBadgeState(stockStatus, stockQuantity);
  return (
    <span className={`admin-stock-badge ${variant}`}>
      <span className="admin-badge-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
