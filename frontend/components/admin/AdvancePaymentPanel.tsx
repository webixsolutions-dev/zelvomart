"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "react-toastify";
import "@/components/admin/payments.css";
import { ErrorBanner } from "@/components/admin/AdminListView";
import { AdminLoading } from "@/components/admin/useAdminData";
import { FlagChips, PROOF_STATUS } from "@/components/admin/PaymentBits";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { adminProxyUrl, clientApi } from "@/lib/client-api";
import { money } from "@/lib/format";

export const when = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Karachi",
      })
    : "–";
const ACTION_LABEL: Record<string, string> = {
  payment_verify: "Verified",
  payment_partial: "Verified as partial",
  payment_reject: "Rejected",
  payment_refund: "Refund recorded",
};
const closedOrder = (status: string) =>
  status === "CANCELLED" || status === "RETURNED";
const shown = (value: number | null | undefined) =>
  value == null ? "–" : money(value);

/** The money for an advance order at a glance: total, received, refunded and what the courier collects. */
export function PaymentSummary({ order }: { order: any }) {
  const closed = closedOrder(order.status);
  return (
    <dl className="pay-summary">
      <div>
        <dt>Order total</dt>
        <dd>{money(order.total)}</dd>
      </div>
      <div>
        <dt>Received</dt>
        <dd>{money(order.advanceReceived || 0)}</dd>
      </div>
      {Number(order.advanceRefunded) > 0 && (
        <div>
          <dt>Refunded</dt>
          <dd>-{money(order.advanceRefunded)}</dd>
        </div>
      )}
      <div className="grand">
        {closed ? (
          <>
            <dt>Courier</dt>
            <dd>Not booked (order {order.status.toLowerCase()})</dd>
          </>
        ) : (
          <>
            <dt>Courier collects (COD)</dt>
            <dd>{money(order.codToCollect)}</dd>
          </>
        )}
      </div>
    </dl>
  );
}

/**
 * Everything staff need for one advance-payment proof: screenshot, comparison, verify / reject, refunds and history.
 * Used on Admin → Payments → proof and, embedded, on the order page.
 */
export function AdvancePaymentPanel({
  proofId,
  embedded = false,
  onChanged,
  header,
}: {
  proofId: string;
  embedded?: boolean;
  onChanged?: () => void;
  /** The page title (the Payments screen shows the order number and status above the panel). */
  header?: (data: any) => ReactNode;
}) {
  const role = useAdminRole();
  const canWrite = ["OWNER", "MANAGER", "ORDER_AGENT"].includes(role || "");
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"verify" | "reject">("verify");
  const [received, setReceived] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const load = async () => {
    setError("");
    try {
      setD(await clientApi<any>(`/api/admin/payments/${proofId}`, {}, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this payment");
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofId]);

  async function send(
    path: string,
    body: Record<string, unknown>,
    done: string,
  ) {
    setBusy(true);
    try {
      await clientApi(
        `/api/admin/payments/${proofId}/${path}`,
        { method: "POST", body: JSON.stringify(body) },
        true,
      );
      toast.success(done);
      setReceived("");
      setRefundReason("");
      setRefundAmount("");
      await load();
      onChanged?.();
    } catch {
      // clientApi already shows the reason.
    } finally {
      setBusy(false);
    }
  }
  const text = (f: FormData, key: string) =>
    String(f.get(key) || "").trim() || undefined;

  function submitDecision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const common = {
      notes: text(f, "notes"),
      customerMessage: text(f, "customerMessage"),
    };
    if (mode === "verify") {
      const amount = Number(received);
      void send(
        "verify",
        {
          amountReceived: amount,
          merchantReference: text(f, "merchantReference"),
          checked: f.get("checked") === "on",
          ...common,
        },
        amount >= d.expected.amount
          ? "Payment verified. The customer was sent the confirmation."
          : `Partial payment saved. The courier collects ${money(d.expected.amount - amount)}.`,
      );
    } else {
      void send(
        "reject",
        { reason: f.get("reason"), ...common },
        "Proof rejected. The customer was told why.",
      );
    }
  }

  function submitRefund(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cancelOrder = f.get("cancelOrder") === "on";
    const amount = Number(refundAmount);
    if (
      !window.confirm(
        `Record a refund of ${money(amount)} for ${d.order.orderNumber}?${cancelOrder ? " The order will be cancelled." : ""} Send the money from the Easypaisa merchant app first.`,
      )
    )
      return;
    void send(
      "refund",
      {
        amount,
        reason: refundReason,
        reference: text(f, "reference"),
        notes: text(f, "notes"),
        customerMessage: text(f, "customerMessage"),
        cancelOrder,
      },
      cancelOrder ? "Refund recorded and order cancelled." : "Refund recorded.",
    );
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!d) return <AdminLoading />;
  const { proof, order, expected } = d;
  const open = ["SUBMITTED", "MISMATCH"].includes(proof.status);
  const closed = closedOrder(order.status);
  const src = !proof.imageUrl
    ? ""
    : proof.imageIsSigned
      ? proof.imageUrl
      : adminProxyUrl(proof.imageUrl);
  const amountBad =
    proof.amountSent != null &&
    Math.abs(proof.amountSent - expected.amount) >= 1;
  const ocr = proof.ocr;
  const receivedNumber = Number(received);
  const fromAutoRead = proof.detailsFromAutoRead ? (
    <span className="pay-tag" title="Read from the screenshot, not typed">
      auto-read
    </span>
  ) : null;

  return (
    <div className={`pay-admin ${embedded ? "pay-embedded" : ""}`}>
      {header?.(d)}
      <p className="pay-warning" role="note">
        <strong>A screenshot is never proof on its own.</strong> Open the
        Easypaisa merchant app, find this payment credited to{" "}
        {expected.accountName}, and only then verify. Do not dispatch before
        that.
      </p>
      <FlagChips flags={proof.flags} />

      <div className="pay-detail" style={{ marginTop: 14 }}>
        <section className="pay-card">
          <h2>Screenshot</h2>
          {src ? (
            <>
              <button
                type="button"
                className="pay-shot"
                onClick={() => setZoom(true)}
                aria-label="Zoom the screenshot"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Payment screenshot for ${order.orderNumber}`}
                />
              </button>
              <small className="pay-none">
                Tap to zoom. Shown only to staff; the file is private.
              </small>
            </>
          ) : (
            <p className="pay-hint">
              No screenshot: the customer typed the TID and amount. Find them
              in the Easypaisa merchant app before verifying.
            </p>
          )}
        </section>

        <div className="pay-actions">
          <section className="pay-card">
            <h2>Payment</h2>
            <PaymentSummary order={order} />
          </section>

          <section className="pay-card">
            <h2>Compare</h2>
            <table className="pay-compare">
              <thead>
                <tr>
                  <th></th>
                  <td>
                    <b>Expected</b>
                  </td>
                  <td>
                    <b>Customer says</b>
                  </td>
                  {ocr && (
                    <td>
                      <b>Auto-read</b>
                    </td>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Amount</th>
                  <td>{money(expected.amount)}</td>
                  <td className={amountBad ? "bad" : ""}>
                    {shown(proof.amountSent)}
                    {proof.amountSent != null && fromAutoRead}
                  </td>
                  {ocr && <td>{shown(ocr.amount)}</td>}
                </tr>
                <tr>
                  <th>TID</th>
                  <td>Find it in the merchant app</td>
                  <td>
                    {proof.tid ? <code>{proof.tid}</code> : "–"}
                    {proof.tid && fromAutoRead}
                  </td>
                  {ocr && <td>{ocr.tid || "–"}</td>}
                </tr>
                <tr>
                  <th>Paid to</th>
                  <td>
                    {expected.accountName} · Till {expected.tillId}
                  </td>
                  <td>
                    {proof.method === "RAAST_QR"
                      ? "Raast QR"
                      : proof.method === "TILL"
                        ? "Till ID"
                        : "Other"}
                  </td>
                  {ocr && <td>{ocr.receiver || "–"}</td>}
                </tr>
                <tr>
                  <th>Sender</th>
                  <td>–</td>
                  <td>
                    {proof.senderName || "–"}
                    {proof.senderLast4 ? ` · ••••${proof.senderLast4}` : ""}
                  </td>
                  {ocr && <td>{ocr.sender || "–"}</td>}
                </tr>
                <tr>
                  <th>Time</th>
                  <td>After {when(order.createdAt)}</td>
                  <td>{when(proof.paidAt)}</td>
                  {ocr && <td>{when(ocr.dateTime)}</td>}
                </tr>
              </tbody>
            </table>
            {ocr && (
              <small className="pay-none">
                Auto-read is a hint only (
                {Math.round((ocr.confidence || 0) * 100)}% sure). It never
                verifies a payment.
              </small>
            )}
          </section>

          {open && canWrite ? (
            <form className="pay-card pay-actions" onSubmit={submitDecision}>
              <h2>Decision</h2>
              <div className="pay-tabs" role="group" aria-label="Decision">
                {(["verify", "reject"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m === "verify" ? "Verify payment" : "Reject"}
                  </button>
                ))}
              </div>
              {mode === "verify" ? (
                <>
                  <label className="field">
                    Amount received in the merchant app (Rs) *
                    <input
                      name="amountReceived"
                      type="number"
                      inputMode="decimal"
                      required
                      min={1}
                      step="1"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder={`Amount due ${Math.round(expected.amount)}`}
                    />
                  </label>
                  {receivedNumber > 0 && (
                    <p
                      className={`pay-hint ${receivedNumber < expected.amount ? "warn" : "ok"}`}
                      role="status"
                    >
                      {receivedNumber < expected.amount
                        ? `Less than the ${money(expected.amount)} due: saved as a partial payment. The courier collects ${money(expected.amount - receivedNumber)}.`
                        : receivedNumber > expected.amount
                          ? `Full payment, ${money(receivedNumber - expected.amount)} more than the total. Nothing to collect; record a refund for the extra.`
                          : "Full payment. Nothing to collect on delivery."}
                    </p>
                  )}
                  <label className="field">
                    <span>
                      Merchant app reference{" "}
                      <span className="pay-label-note">
                        (optional, prefilled with the customer&apos;s TID)
                      </span>
                    </span>
                    <input
                      name="merchantReference"
                      maxLength={80}
                      defaultValue={proof.tid || ""}
                      placeholder="Transaction ID shown in the Easypaisa merchant app"
                      autoComplete="off"
                    />
                  </label>
                  <label className="field pay-check">
                    <input type="checkbox" name="checked" required />
                    <span>
                      I checked this payment in the Easypaisa merchant app *
                    </span>
                  </label>
                </>
              ) : (
                <label className="field">
                  Reason (the customer sees this) *
                  <select name="reason" required defaultValue="NOT_RECEIVED">
                    {Object.entries(
                      d.rejectReasons as Record<string, string>,
                    ).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <MessageFields />
              <div className="pay-btns">
                <button
                  className={`admin-btn ${mode === "reject" ? "admin-btn-danger" : "admin-btn-primary"}`}
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : mode === "verify"
                      ? receivedNumber > 0 && receivedNumber < expected.amount
                        ? `Save partial payment of ${money(receivedNumber)}`
                        : "Verify payment"
                      : "Reject proof"}
                </button>
              </div>
            </form>
          ) : (
            <section className="pay-card">
              <h2>Decision</h2>
              {open ? (
                <p className="pay-none">
                  Only order staff can verify payments.
                </p>
              ) : (
                <p className="pay-done">
                  <b>{PROOF_STATUS[proof.status]?.label || proof.status}</b> by{" "}
                  {proof.reviewedBy || "staff"} on {when(proof.reviewedAt)}
                  {proof.amountReceived != null && (
                    <> · {money(proof.amountReceived)} received</>
                  )}
                  {proof.merchantReference ? (
                    <>
                      {" "}
                      · merchant reference{" "}
                      <code>{proof.merchantReference}</code>
                    </>
                  ) : null}
                  {proof.rejectReason ? (
                    <> · {d.rejectReasons[proof.rejectReason]}</>
                  ) : null}
                  {!closed && ["VERIFIED", "PARTIAL"].includes(proof.status) && (
                    <>
                      <br />
                      Courier collects {money(order.codToCollect)} on delivery.
                    </>
                  )}
                </p>
              )}
              {proof.notes && (
                <p className="pay-hint">
                  <b>Private staff note:</b> {proof.notes}
                </p>
              )}
              {proof.refundedAt && (
                <p className="pay-done">
                  Refunds recorded: {money(proof.refundAmount)} (latest by{" "}
                  {proof.refundedBy} on {when(proof.refundedAt)}
                  {proof.refundReason
                    ? ` · ${d.refundReasons[proof.refundReason] || proof.refundReason}`
                    : ""}
                  {proof.refundReference
                    ? ` · reference ${proof.refundReference}`
                    : ""}
                  ).
                </p>
              )}
              {canWrite &&
                ["VERIFIED", "PARTIAL"].includes(proof.status) &&
                order.refundable > 0 && (
                  <details>
                    <summary>Record a refund</summary>
                    <form className="pay-actions" onSubmit={submitRefund}>
                      <p className="pay-none">
                        Send the money back in the Easypaisa merchant app first;
                        this records it. You can refund up to{" "}
                        {money(order.refundable)} (received minus earlier
                        refunds).
                      </p>
                      <label className="field">
                        Reason *
                        <select
                          name="reason"
                          required
                          value={refundReason}
                          onChange={(e) => {
                            setRefundReason(e.target.value);
                            const suggested =
                              d.refundSuggestions?.[e.target.value];
                            if (suggested != null)
                              setRefundAmount(String(suggested));
                          }}
                        >
                          <option value="" disabled>
                            Choose why
                          </option>
                          {Object.entries(
                            d.refundReasons as Record<string, string>,
                          ).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {refundReason === "CUSTOMER_CANCELLED" && (
                        <p className="pay-hint">
                          Refund policy: paid amount minus delivery charges (
                          {money(order.deliveryFee || 0)}).
                        </p>
                      )}
                      <div className="pay-split">
                        <label className="field">
                          Amount (Rs) *
                          <input
                            name="amount"
                            type="number"
                            required
                            min={1}
                            max={order.refundable}
                            step="1"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>
                            Refund reference{" "}
                            <span className="pay-label-note">(optional)</span>
                          </span>
                          <input name="reference" maxLength={80} />
                        </label>
                      </div>
                      {!closed && (
                        <label className="field pay-check">
                          <input
                            type="checkbox"
                            name="cancelOrder"
                            defaultChecked
                          />
                          <span>
                            Cancel the order (stock goes back; nothing is
                            booked or collected)
                          </span>
                        </label>
                      )}
                      <MessageFields />
                      <button
                        className="admin-btn admin-btn-light"
                        disabled={busy || !refundReason}
                      >
                        Record refund
                      </button>
                    </form>
                  </details>
                )}
            </section>
          )}

          {(d.otherProofs.length > 0 || d.history.length > 0) && (
            <section className="pay-card">
              <h2>History</h2>
              <ul className="pay-history">
                {d.history.map((h: any, i: number) => (
                  <li key={i}>
                    {when(h.createdAt)} · {ACTION_LABEL[h.action] || h.action}{" "}
                    by {h.user || "staff"}
                  </li>
                ))}
                {d.otherProofs.map((p: any) => (
                  <li key={p.id}>
                    Other proof for this order:{" "}
                    <Link href={`/admin/payments/${p.id}`}>
                      {PROOF_STATUS[p.status]?.label || p.status} ·{" "}
                      {shown(p.amountSent)}
                    </Link>{" "}
                    · {when(p.createdAt)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {zoom && (
        <div
          className="pay-zoom"
          role="dialog"
          aria-label="Screenshot, full size"
          onClick={() => setZoom(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Payment screenshot for ${order.orderNumber}, full size`}
          />
        </div>
      )}
    </div>
  );
}

/** Staff note (never sent) and the optional message that goes into the customer's email. */
function MessageFields() {
  return (
    <>
      <label className="field">
        <span>
          Staff note{" "}
          <span className="pay-label-note">
            (Private – not sent to the customer)
          </span>
        </span>
        <textarea name="notes" maxLength={1000} rows={2} />
      </label>
      <label className="field">
        <span>
          Message to customer{" "}
          <span className="pay-label-note">
            (optional, added to their email)
          </span>
        </span>
        <textarea name="customerMessage" maxLength={1000} rows={2} />
      </label>
    </>
  );
}
