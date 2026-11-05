"use client";
import { useState } from "react";
import SettingsForm from "@/components/admin/SettingsForm";
import { adminFetch, clientApi } from "@/lib/client-api";

type Advance = {
  enabled?: boolean;
  accountName?: string;
  tillId?: string;
  qrImageUrl?: string;
  discount?: number;
  minSubtotal?: number;
  firstReminderMinutes?: number;
  reminderHours?: number;
  expiryHours?: number;
  verificationHours?: string;
  autoRead?: boolean;
};
type AutoReadTest = {
  model?: string;
  httpStatus?: number | null;
  error?: string;
  message?: string;
  prefill?: { tid: string | null; amount: number | null; sender: string | null } | null;
};

const DEMO_TILL = "DEMO-TILL";
/** Same rule as the backend (lib/advance-payment.ts): a missing or demo Till ID, or no real QR, is demo. */
const usesDemo = (till: string, qr: string) =>
  !till.trim() ||
  till.trim().toUpperCase() === DEMO_TILL ||
  !qr ||
  /demo/i.test(qr);

/**
 * Settings → Payments → Advance payment (Easypaisa Till / Raast QR). The QR is uploaded exactly as it is (no
 * conversion), because a re-encoded or resized QR may stop scanning.
 */
export default function AdvancePaymentSettings({
  value,
  production,
  onSaved,
}: {
  value: Advance | undefined;
  production: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const v = value || {};
  const [till, setTill] = useState(v.tillId ?? DEMO_TILL);
  const [qr, setQr] = useState(v.qrImageUrl || "");
  const [enabled, setEnabled] = useState(v.enabled === true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AutoReadTest | null>(null);
  const demo = usesDemo(till, qr);

  async function testAutoRead() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await adminFetch("/api/admin/payments/auto-read/test", { method: "POST" });
      const result = (await response.json().catch(() => null)) as AutoReadTest | null;
      setTestResult(
        result && (result.error || result.prefill)
          ? result
          : { error: String(response.status), message: "The backend did not return an auto-read result." },
      );
    } catch {
      setTestResult({ error: "CONNECTION_FAILED", message: "The backend could not be reached." });
    } finally {
      setTesting(false);
    }
  }

  async function uploadQr(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await adminFetch("/api/admin/payments/qr", {
        method: "POST",
        body: data,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Upload failed");
      setQr(body.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SettingsForm
      label="Save advance payment settings"
      onSave={async (f) => {
        const num = (key: string, fallback: number) => {
          const n = Number(f.get(key));
          return Number.isFinite(n) ? n : fallback;
        };
        await clientApi(
          "/api/admin/settings",
          {
            method: "PUT",
            body: JSON.stringify({
              "payments.advance": {
                enabled,
                accountName:
                  String(f.get("accountName") || "").trim() || "Zelvomart",
                tillId: till.trim(),
                qrImageUrl: qr,
                discount: num("discount", 200),
                minSubtotal: num("minSubtotal", 0),
                firstReminderMinutes: num("firstReminderMinutes", 30),
                reminderHours: num("reminderHours", 2),
                expiryHours: num("expiryHours", 24),
                verificationHours:
                  String(f.get("verificationHours") || "").trim() ||
                  "9am – 9pm",
                autoRead: f.get("autoRead") === "on",
              },
            }),
          },
          true,
        );
        await onSaved();
      }}
    >
      <p className="settings-section-note full">
        Customers can keep Cash on Delivery (always first) or pay in advance to
        your Easypaisa Till / Raast QR for a flat discount. There is no payment
        API: staff verify each payment in the Easypaisa merchant app (Admin →
        Payments) before dispatch.
      </p>
      {demo && (
        <div
          className="admin-inline-note full"
          role="note"
          style={{ background: "#fff7e6", borderColor: "#f5c26b" }}
        >
          <b>Demo values in use.</b>{" "}
          {production
            ? "Customers on www.zelvomart.com do not see advance payment until you save a real Till ID and upload the real QR. Enabling is refused until then."
            : "Local and preview checkouts show the option with a “DEMO – do not send money” banner."}
        </div>
      )}
      <label className="admin-check full">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <strong>Offer advance payment at checkout</strong>
      </label>
      <label className="field">
        <span>Account name (shown to customers)</span>
        <input
          name="accountName"
          required
          maxLength={60}
          defaultValue={v.accountName || "Zelvomart"}
        />
      </label>
      <label className="field">
        <span>Easypaisa Till ID</span>
        <input
          name="tillId"
          value={till}
          onChange={(e) => setTill(e.target.value)}
          maxLength={40}
          placeholder="e.g. 981234567"
        />
      </label>
      <div className="field full">
        <span>Raast QR (from the Easypaisa merchant app)</span>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Current Raast QR"
              width={120}
              style={{
                height: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            />
          ) : (
            <span className="admin-inline-note">
              No QR uploaded: the payment page shows a demo QR.
            </span>
          )}
          <label className="admin-btn admin-btn-light">
            {uploading ? "Uploading…" : qr ? "Replace QR" : "Upload QR"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => void uploadQr(e.target.files?.[0])}
            />
          </label>
          {qr && (
            <button
              type="button"
              className="admin-btn admin-btn-light"
              onClick={() => setQr("")}
            >
              Remove
            </button>
          )}
        </div>
        <small>
          Uploaded exactly as it is (no crop, resize or re-compression). Test it
          after saving: scan it from the gallery in two bank apps.
        </small>
        {uploadError && (
          <small style={{ color: "#b4233a" }}>{uploadError}</small>
        )}
      </div>
      <label className="field">
        <span>Discount (Rs)</span>
        <input
          name="discount"
          type="number"
          min={0}
          step={1}
          defaultValue={v.discount ?? 200}
        />
      </label>
      <label className="field">
        <span>Minimum subtotal for the discount (Rs, 0 = none)</span>
        <input
          name="minSubtotal"
          type="number"
          min={0}
          step={1}
          defaultValue={v.minSubtotal ?? 0}
        />
      </label>
      <label className="field">
        <span>First payment reminder (minutes)</span>
        <input
          name="firstReminderMinutes"
          type="number"
          min={5}
          step={1}
          defaultValue={v.firstReminderMinutes ?? 30}
        />
        <small>
          The &ldquo;Complete your payment&rdquo; email. Advance orders get no
          email when they are placed.
        </small>
      </label>
      <label className="field">
        <span>Second reminder after (hours)</span>
        <input
          name="reminderHours"
          type="number"
          min={1}
          step={1}
          defaultValue={v.reminderHours ?? 2}
        />
      </label>
      <label className="field">
        <span>
          Payment window (hours, then “expired”; never auto-cancelled)
        </span>
        <input
          name="expiryHours"
          type="number"
          min={2}
          step={1}
          defaultValue={v.expiryHours ?? 24}
        />
      </label>
      <label className="field">
        <span>Verification hours (shown to customers)</span>
        <input
          name="verificationHours"
          maxLength={40}
          defaultValue={v.verificationHours || "9am – 9pm"}
        />
      </label>
      <label className="admin-check full">
        <input
          type="checkbox"
          name="autoRead"
          defaultChecked={v.autoRead === true}
        />
        <span>
          Auto-read screenshots (fills the comparison for staff; needs
          GEMINI_API_KEY on the backend; never verifies)
        </span>
      </label>
      <div className="field full">
        <div>
          <button
            type="button"
            className="admin-btn admin-btn-light"
            disabled={testing}
            onClick={() => void testAutoRead()}
          >
            {testing ? "Testing auto-read…" : "Test auto-read"}
          </button>
        </div>
        <small>Sends a sample receipt to Gemini to check the backend configuration.</small>
        <div role="status" aria-live="polite">
          {testResult && (
            <>
              <strong>
                {testResult.error
                  ? [testResult.httpStatus && `HTTP ${testResult.httpStatus}`, testResult.error]
                      .filter(Boolean)
                      .join(" · ")
                  : "Sample receipt read successfully"}
              </strong>
              {testResult.model && <span> · {testResult.model}</span>}
              {testResult.message && <div>{testResult.message}</div>}
              {testResult.prefill && (
                <div>
                  TID {testResult.prefill.tid ?? "—"} · Amount{" "}
                  {testResult.prefill.amount == null ? "—" : `Rs ${testResult.prefill.amount}`} · Sender{" "}
                  {testResult.prefill.sender ?? "—"}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p className="settings-section-note full">
        WhatsApp support uses the store WhatsApp number (Store settings).
      </p>
    </SettingsForm>
  );
}
