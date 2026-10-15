"use client";

interface StockBadgeProps {
  stock?: number;
  stockQuantity?: number;
}

export default function StockBadge({ stock, stockQuantity }: StockBadgeProps) {
  const qty = Number(stock ?? stockQuantity ?? 0);

  let variant = "in";
  let label = "In stock";

  if (qty <= 0) {
    variant = "out";
    label = "Out of stock";
  } else if (qty <= 5) {
    variant = "low";
    label = "Low stock";
  }

  return (
    <span className={`admin-stock-badge ${variant}`}>
      <span className="admin-badge-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
