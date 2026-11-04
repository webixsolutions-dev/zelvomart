"use client";

/** Shared by Admin → Payments (list and detail). */
export const FLAG_LABELS: Record<string, string> = {
  AMOUNT: "Amount differs",
  DUPLICATE_TID: "TID used before",
  DUPLICATE_IMAGE: "Screenshot seen before",
  TIME: "Time outside order",
  RECEIVER: "Receiver differs",
};
export const PROOF_STATUS: Record<
  string,
  { label: string; tone: "warning" | "success" | "danger" | "info" }
> = {
  SUBMITTED: { label: "To verify", tone: "warning" },
  MISMATCH: { label: "Amount differs", tone: "danger" },
  VERIFIED: { label: "Verified", tone: "success" },
  PARTIAL: { label: "Partial", tone: "info" },
  REJECTED: { label: "Rejected", tone: "danger" },
};
export function FlagChips({ flags }: { flags: string[] }) {
  if (!flags.length) return <span className="pay-none">No flags</span>;
  return (
    <span className="pay-flags">
      {flags.map((flag) => (
        <span
          key={flag}
          className={`pay-flag ${flag === "TIME" ? "tone-warn" : ""}`}
        >
          ⚑ {FLAG_LABELS[flag] || flag}
        </span>
      ))}
    </span>
  );
}
