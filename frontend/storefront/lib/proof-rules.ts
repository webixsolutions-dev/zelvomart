/**
 * Payment proof form rule (owner decision; the backend checks the same rule in lib/payment-proof.ts):
 * a screenshot alone is enough, or the TID and the amount without one. The sender name is recommended, never
 * required. A value that is typed must still be valid.
 */
export const PROOF_NEEDS_SCREENSHOT_OR_DETAILS =
  "Upload your payment screenshot, or enter the TID and amount from your receipt.";

export type ProofInput = {
  hasScreenshot: boolean;
  tid: string;
  amount: string;
  senderName: string;
  senderLast4: string;
};
export type ProofErrors = Partial<
  Record<"screenshot" | "tid" | "amount" | "senderName" | "senderLast4" | "form", string>
>;

const cleanTid = (tid: string) => tid.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** TID and amount are required (marked *) only while no screenshot is attached. */
export const detailsRequired = (hasScreenshot: boolean) => !hasScreenshot;

export function proofErrors(input: ProofInput): ProofErrors {
  const found: ProofErrors = {};
  const tid = cleanTid(input.tid);
  const amount = input.amount.trim();
  if (!input.hasScreenshot && (!tid || !amount)) {
    found.form = PROOF_NEEDS_SCREENSHOT_OR_DETAILS;
    if (!tid) found.tid = "Enter the transaction ID (TID) from your receipt.";
    if (!amount) found.amount = "Type the exact amount you sent.";
  }
  if (tid && (tid.length < 6 || tid.length > 40)) found.tid = "Enter the transaction ID (TID) from your receipt.";
  if (amount && !(Number(amount) > 0)) found.amount = "Type the exact amount you sent.";
  if (input.senderName.trim() && input.senderName.trim().length < 2)
    found.senderName = "Enter the name on the account you paid from.";
  if (input.senderLast4 && !/^\d{4}$/.test(input.senderLast4))
    found.senderLast4 = "Enter exactly 4 digits, or leave it empty.";
  return found;
}
