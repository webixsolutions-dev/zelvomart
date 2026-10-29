"use client";

import { CircleAlert, X } from "lucide-react";
import { useShop } from "@store/lib/store";

/** Shows what changed in the cart (bundles rounded up, the 20 pcs limit, sold-out items taken out). */
export function CartNotes() {
  const { cartNotes, dismissCartNotes } = useShop();
  if (!cartNotes.length) return null;
  return (
    <div className="cart-notes" role="status" aria-live="polite">
      <CircleAlert size={16} aria-hidden="true" />
      <ul>
        {cartNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <button type="button" className="icon-btn subtle" aria-label="Dismiss" onClick={dismissCartNotes}>
        <X size={14} />
      </button>
    </div>
  );
}
