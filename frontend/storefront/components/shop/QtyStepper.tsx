"use client";

import { Minus, Plus } from "lucide-react";

export function QtyStepper({ value, onChange, size = "md" }: { value: number; onChange: (n: number) => void; size?: "sm" | "md" }) {
  return (
    <div className={`qty qty-${size}`}>
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(size === "sm" ? 0 : 1, value - 1))}>
        <Minus size={14} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(99, value + 1))}>
        <Plus size={14} />
      </button>
    </div>
  );
}
