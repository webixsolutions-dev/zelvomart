"use client";

import { useState } from "react";

/** Order number with a copy button (thank-you page). */
export default function CopyOrderNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="mock-order-copy">
      <b>Order #{value}</b>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </span>
  );
}
