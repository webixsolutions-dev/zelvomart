"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import "@/components/admin/catalog-pages.css";
import "../payments.css";
import { ErrorBanner, StatusBadge } from "@/components/admin/AdminListView";
import { AdminLoading } from "@/components/admin/useAdminData";
import { FlagChips, PROOF_STATUS } from "@/components/admin/PaymentBits";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { adminProxyUrl, clientApi } from "@/lib/client-api";
import { money } from "@/lib/format";

const when = (s?: string | null) =>
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
  payment_partial: "Marked partial",
  payment_reject: "Rejected",
  payment_refund: "Refund recorded",
};

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const role = useAdminRole();
  const canWrite = ["OWNER", "MANAGER", "ORDER_AGENT"].includes(role || "");
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"verify" | "partial" | "reject">("verify");
  const load = async () => {
    setError("");
    try {
      setD(await clientApi<any>(`/api/admin/payments/${id}`, {}, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this payment");
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function send(
    path: string,
    body: Record<string, unknown>,
    done: string,
  ) {
    setBusy(true);
    try {
      await clientApi(
        `/api/admin/payments/${id}/${path}`,
        { method: "POST", body: JSON.stringify(body) },
        true,
      );
      toast.success(done);
      await load();
    } catch {
      // clientApi already shows the reason.
    } finally {
      setBusy(false);
    }
  }
  function submitDecision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const notes = String(f.get("notes") || "").trim() || undefined;
    const merchantReference = String(f.get("merchantReference") || "").trim();
    if (mode === "verify") {
      const differs = Math.abs(d.proof.amountSent - d.expected.amount) >= 1;
      const question = differs
        ? `The customer says they sent ${money(d.proof.amountSent)}, not ${money(d.expected.amount)}. Verify only if the full ${money(d.expected.amount)} arrived in the Easypaisa merchant app; otherwise use "Mark partial".`
        : `Verify ${money(d.expected.amount)} for ${d.order.orderNumber}? Only if you found this payment in the Easypaisa merchant app.`;
      if (!window.confirm(question)) return;
      void send(
        "verify",
        { merchantReference, notes },
        "Payment verified. The order moved to New.",
      );
    } else if (mode === "partial") {
      void send(
        "partial",
        {
          merchantReference,
          amountReceived: Number(f.get("amountReceived")),
          notes,
        },
        "Partial payment saved. The rest is collected on delivery.",
      );
    } else {
      void send(
        "reject",
        { reason: f.get("reason"), notes },
        "Proof rejected. The customer was told why.",
      );
    }
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!d) return <AdminLoading />;
  const { proof, order, expected } = d;
  const open = ["SUBMITTED", "MISMATCH"].includes(proof.status);
  const src = proof.imageIsSigned
    ? proof.imageUrl
    : adminProxyUrl(proof.imageUrl);
  const amountBad = Math.abs(proof.amountSent - expected.amount) >= 1;
  const ocr = proof.ocr;

  return (
    <div className="admin-catalog-page pay-admin">
      <p>
        <Link href="/admin/payments">← All payments</Link>
      </p>
      <div className="admin-title">
        <div>
          <h1>
            Payment for{" "}
            <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>{" "}
            <StatusBadge
              value={proof.status}
              label={PROOF_STATUS[proof.status]?.label}
              tone={PROOF_STATUS[proof.status]?.tone}
            />
          </h1>
          <p>
            {order.fullName} · {order.city} · ordered {when(order.createdAt)} ·
            proof sent {when(proof.createdAt)}
          </p>
        </div>
      </div>
      <p className="pay-warning" role="note">
        <strong>A screenshot is never proof on its own.</strong> Open the
        Easypaisa merchant app, find this TID and the amount credited to{" "}
        {expected.accountName}, and only then verify. Do not dispatch before
        that.
      </p>
      <FlagChips flags={proof.flags} />

      <div className="pay-detail" style={{ marginTop: 14 }}>
        <section className="pay-card">
          <h2>Screenshot</h2>
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
        </section>

        <div className="pay-actions">
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
                    {money(proof.amountSent)}
                  </td>
                  {ocr && (
                    <td>{ocr.amount == null ? "–" : money(ocr.amount)}</td>
                  )}
                </tr>
                <tr>
                  <th>TID</th>
                  <td>Find it in the merchant app</td>
                  <td>
                    <code>{proof.tid}</code>
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
                    {proof.senderName}
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
                {(["verify", "partial", "reject"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m === "verify"
                      ? "Verify"
                      : m === "partial"
                        ? "Mark partial"
                        : "Reject"}
                  </button>
                ))}
              </div>
              {mode !== "reject" && (
                <label className="field">
                  Merchant app reference *
                  <input
                    name="merchantReference"
                    required
                    minLength={4}
                    maxLength={80}
                    placeholder="Transaction ID shown in the Easypaisa merchant app"
                    autoComplete="off"
                  />
                </label>
              )}
              {mode === "partial" && (
                <label className="field">
                  Amount actually received (Rs) *
                  <input
                    name="amountReceived"
                    type="number"
                    required
                    min={1}
                    max={expected.amount - 1}
                    step="1"
                  />
                  <small className="pay-none">
                    The rest ({money(expected.amount)} minus this) is collected
                    in cash on delivery.
                  </small>
                </label>
              )}
              {mode === "reject" && (
                <label className="field">
                  Reason (the customer sees this) *
                  <select name="reason" required defaultValue="NOT_RECEIVED">
                    {Object.entries(
                      d.rejectReasons as Record<string, string>,
                    ).map(([key, text]) => (
                      <option key={key} value={key}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field">
                Staff note <span className="pay-none">(optional, private)</span>
                <textarea name="notes" maxLength={1000} rows={2} />
              </label>
              <div className="pay-btns">
                <button
                  className={`admin-btn ${mode === "reject" ? "admin-btn-danger" : "admin-btn-primary"}`}
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : mode === "verify"
                      ? `Verify ${money(expected.amount)}`
                      : mode === "partial"
                        ? "Save partial payment"
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
                  <br />
                  Courier collects {money(order.codToCollect)} on delivery.
                </p>
              )}
              {proof.refundedAt && (
                <p className="pay-done">
                  Refund of {money(proof.refundAmount)} recorded by{" "}
                  {proof.refundedBy} on {when(proof.refundedAt)} (reference{" "}
                  {proof.refundReference}).
                </p>
              )}
              {canWrite &&
                ["VERIFIED", "PARTIAL"].includes(proof.status) &&
                !proof.refundedAt && (
                  <details>
                    <summary>Record a refund</summary>
                    <form
                      className="pay-actions"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void send(
                          "refund",
                          {
                            amount: Number(f.get("amount")),
                            reference: f.get("reference"),
                            notes: f.get("notes") || undefined,
                          },
                          "Refund recorded.",
                        );
                      }}
                    >
                      <p className="pay-none">
                        Send the money back in the Easypaisa merchant app first;
                        this only records it.
                      </p>
                      <div className="pay-split">
                        <label className="field">
                          Amount (Rs)
                          <input
                            name="amount"
                            type="number"
                            required
                            min={1}
                            defaultValue={
                              order.advanceReceived || expected.amount
                            }
                          />
                        </label>
                        <label className="field">
                          Refund reference
                          <input
                            name="reference"
                            required
                            minLength={3}
                            maxLength={80}
                          />
                        </label>
                      </div>
                      <button
                        className="admin-btn admin-btn-light"
                        disabled={busy}
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
                      {money(p.amountSent)}
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
