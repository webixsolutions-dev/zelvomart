"use client";

import { Minus, Plus } from "lucide-react";

/**
 * − / + buttons. `step` is 2 on bundle lines (one bundle at a time). The parent decides the upper limit and
 * shows the message, so "+" always asks for the next value.
 */
export function QtyStepper({
  value,
  onChange,
  size = "md",
  step = 1,
  label = "quantity",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "md";
  step?: number;
  label?: string;
}) {
  const min = size === "sm" ? 0 : step;
  return (
    <div className={`qty qty-${size}`}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))}>
        <Minus size={14} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + step)}>
        <Plus size={14} />
      </button>
    </div>
  );
}
