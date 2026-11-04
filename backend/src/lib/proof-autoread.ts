/**
 * Optional auto-read of payment screenshots (Gemini Flash-Lite). Off unless Settings → Advance payment → Auto-read
 * is on AND GEMINI_API_KEY is set. It only fills hints: the customer's form (prefill) and the staff comparison
 * table. It never changes a proof's status and never verifies a payment: staff always check the merchant app.
 * Every call is time-boxed; any failure simply means "no hint".
 */
export type AutoReadResult = {
  isPaymentReceipt: boolean;
  tid: string | null;
  amount: number | null;
  dateTime: Date | null;
  sender: string | null;
  receiver: string | null;
  confidence: number;
};

export interface ProofReader {
  read(image: Buffer, mimeType: string): Promise<AutoReadResult | null>;
}

export const AUTOREAD_TIMEOUT_MS = 8000;
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

const PROMPT = `You read a screenshot of a Pakistani mobile payment receipt (Easypaisa, JazzCash, bank app, Raast).
Return JSON only. Use null when a field is not clearly visible; never guess.
- isPaymentReceipt: true only if this is a completed payment receipt.
- tid: the transaction ID / TID / reference number, exactly as shown.
- amount: the amount paid in PKR as a number (no commas, no currency).
- dateTime: the payment date and time in ISO 8601 with +05:00 if shown.
- sender: the payer's account name if shown.
- receiver: the receiving account / merchant name.
- confidence: 0 to 1, how sure you are about tid and amount together.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isPaymentReceipt: { type: "BOOLEAN" },
    tid: { type: "STRING", nullable: true },
    amount: { type: "NUMBER", nullable: true },
    dateTime: { type: "STRING", nullable: true },
    sender: { type: "STRING", nullable: true },
    receiver: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
  },
  required: ["isPaymentReceipt", "confidence"],
};

const text = (value: unknown, max = 80) => {
  const out = typeof value === "string" ? value.trim().slice(0, max) : "";
  return out || null;
};

/** Model output → a safe result (anything malformed becomes null fields, never an exception). */
export function parseAutoRead(raw: unknown): AutoReadResult | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const amount = Number(v.amount);
  const date = typeof v.dateTime === "string" ? new Date(v.dateTime) : null;
  const confidence = Number(v.confidence);
  return {
    isPaymentReceipt: v.isPaymentReceipt === true,
    tid: text(v.tid, 60),
    amount: Number.isFinite(amount) && amount > 0 && amount < 10_000_000 ? Math.round(amount * 100) / 100 : null,
    dateTime: date && !Number.isNaN(date.getTime()) ? date : null,
    sender: text(v.sender),
    receiver: text(v.receiver),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
}

export function geminiReader(
  apiKey: string,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  fetcher: typeof fetch = fetch,
): ProofReader {
  return {
    async read(image, mimeType) {
      try {
        const response = await fetcher(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [
                { parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: image.toString("base64") } }] },
              ],
              generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
            }),
            signal: AbortSignal.timeout(AUTOREAD_TIMEOUT_MS),
          },
        );
        if (!response.ok) return null;
        const body = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const output = body.candidates?.[0]?.content?.parts?.[0]?.text;
        return output ? parseAutoRead(JSON.parse(output)) : null;
      } catch {
        return null;
      }
    },
  };
}

/** The reader to use now, or null while the switch is off or no key is set. */
export function autoReader(settings: { autoRead: boolean }, env: NodeJS.ProcessEnv = process.env) {
  const key = String(env.GEMINI_API_KEY || "").trim();
  return settings.autoRead && key ? geminiReader(key) : null;
}

/** Letters only, lower case: "Zelvomart (Pvt) Ltd" and "ZELVOMART" compare equal enough. */
const letters = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

/** A receiver name was read and it does not contain the account name (nor the other way round). */
export function receiverDiffers(receiver: string | null, accountName: string) {
  if (!receiver) return false;
  const a = letters(receiver);
  const b = letters(accountName);
  if (!a || !b) return false;
  return !a.includes(b) && !b.includes(a);
}

/** What the customer's form may prefill: only clearly read values, never the amount if it is not a receipt. */
export function prefillFrom(result: AutoReadResult | null) {
  if (!result || !result.isPaymentReceipt || result.confidence < 0.5) return null;
  return { tid: result.tid, amount: result.amount, sender: result.sender };
}
