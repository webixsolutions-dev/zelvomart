import { Truck } from "lucide-react";
import { money } from "@store/lib/format";
import { site } from "@store/lib/site";

/** `free`: the cart already ships free (every item has free delivery), whatever the subtotal. */
export function FreeShippingMeter({ subtotal, free = false }: { subtotal: number; free?: boolean }) {
  const goal = site.shipping.freeOver;
  const left = free ? 0 : Math.max(0, goal - subtotal);
  const pct = free ? 100 : Math.min(100, (subtotal / goal) * 100);
  return (
    <div className={`ship-meter ${left === 0 ? "done" : ""}`}>
      <p>
        <Truck size={16} />
        {left === 0 ? (
          <span>
            <strong>You&apos;ve unlocked free delivery.</strong>
          </span>
        ) : (
          <span>
            Add <strong>{money(left)}</strong> more for <strong>free delivery</strong>
          </span>
        )}
      </p>
      <div className="ship-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
