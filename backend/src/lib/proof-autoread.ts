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
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite";

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

type ReadFailure = {
  model: string;
  httpStatus: number | null;
  status: string;
  message: string;
  elapsedMs: number;
};
type ReadAttempt = { result: AutoReadResult; model: string } | { failure: ReadFailure };

function safeProviderMessage(value: unknown, apiKey: string, imageData: string) {
  if (typeof value !== "string") return "";
  return value
    .replaceAll(apiKey, "[redacted]")
    .replaceAll(imageData || "\0", "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/(?:AIza|AQ\.)[\w.-]+|[A-Za-z0-9+/_=-]{40,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export function geminiReader(
  apiKey: string,
  model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  fetcher: typeof fetch = fetch,
  fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL,
) {
  async function readWithDiagnostics(image: Buffer, mimeType: string): Promise<ReadAttempt> {
    const imageData = image.toString("base64");
    const body = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
    });
    // Share one deadline across both attempts so prefill and the staff job remain bounded.
    const signal = AbortSignal.timeout(AUTOREAD_TIMEOUT_MS);

    async function attempt(modelId: string): Promise<ReadAttempt> {
      const started = performance.now();
      const diagnosticModel =
        /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(modelId) && !modelId.includes(apiKey) ? modelId : "[redacted]";
      let httpStatus: number | null = null;
      const fail = (status: string, message: string): ReadAttempt => {
        const failure = {
          model: diagnosticModel,
          httpStatus,
          status,
          message,
          elapsedMs: Math.round(performance.now() - started),
        };
        console.warn("[payment-auto-read] Gemini request failed", failure);
        return { failure };
      };
      try {
        const response = await fetcher(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
            body,
            signal,
          },
        );
        httpStatus = response.status;
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: { status?: unknown; message?: unknown };
          } | null;
          const status = payload?.error?.status;
          return fail(
            typeof status === "string" && /^[A-Z][A-Z_]{2,39}$/.test(status) && !status.includes(apiKey)
              ? status
              : "HTTP_ERROR",
            safeProviderMessage(payload?.error?.message, apiKey, imageData) ||
              `Gemini returned HTTP ${response.status}.`,
          );
        }
        const payload = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        } | null;
        const output = payload?.candidates?.[0]?.content?.parts
          ?.filter((part) => !part.thought)
          .map((part) => part.text ?? "")
          .join("");
        if (!output) return fail("EMPTY_RESPONSE", "Gemini did not return receipt data.");
        const raw = JSON.parse(output);
        const result =
          typeof raw?.isPaymentReceipt === "boolean" && typeof raw?.confidence === "number" ? parseAutoRead(raw) : null;
        return result
          ? { result, model: diagnosticModel }
          : fail("INVALID_RESPONSE", "Gemini returned an unexpected receipt format.");
      } catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === "TimeoutError"))
          return fail("TIMEOUT", "Gemini did not respond within 8 seconds.");
        if (httpStatus === 200) return fail("INVALID_RESPONSE", "Gemini returned invalid receipt data.");
        return fail("REQUEST_FAILED", "Could not reach Gemini.");
      }
    }

    const primary = await attempt(model);
    if (
      "failure" in primary &&
      fallbackModel !== model &&
      !signal.aborted &&
      (primary.failure.httpStatus === 429 ||
        primary.failure.httpStatus === 404 ||
        ["RESOURCE_EXHAUSTED", "NOT_FOUND"].includes(primary.failure.status))
    ) {
      return attempt(fallbackModel);
    }
    return primary;
  }

  return {
    readWithDiagnostics,
    async read(image: Buffer, mimeType: string) {
      const attempt = await readWithDiagnostics(image, mimeType);
      return "result" in attempt ? attempt.result : null;
    },
  };
}

/** The reader to use now, or null while the switch is off or no key is set. */
export function autoReader(settings: { autoRead: boolean }, env: NodeJS.ProcessEnv = process.env) {
  const key = env.GEMINI_API_KEY?.trim();
  return settings.autoRead && key
    ? geminiReader(
        key,
        env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
        fetch,
        env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL,
      )
    : null;
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
