"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banknote, CircleHelp, Copy, Download, ShieldCheck, Smartphone, TriangleAlert, X } from "lucide-react";
import { money, waLink } from "@store/lib/format";
import { site } from "@store/lib/site";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";
import styles from "./PayView.module.css";
import { PayProofForm } from "./PayProofForm";
import { trackStoreEvent } from "@/lib/client-tracking";

export type PayInfo = {
  orderNumber: string;
  firstName: string;
  paymentMethod: "ADVANCE_EASYPAISA" | "COD";
  paymentStatus: string;
  total: number;
  advanceDiscount: number;
  accountName: string;
  tillId: string;
  qrUrl: string;
  demo: boolean;
  verificationHours: string;
  whatsapp: string;
  refundPolicyPath: string;
  canSwitchToCod: boolean;
  canSubmitProof: boolean;
  /** Auto-read is on: the proof form fills in what it can read from the screenshot (a hint the customer checks). */
  autoRead?: boolean;
  proofsLeft: number;
  /** The customer's latest proof (status only: no TID or screenshot on this page). */
  proof: { status: string; amountSent: number; submittedAt: string; rejectMessage: string | null } | null;
};

const BADGES: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  SUBMITTED: "Proof received – verifying",
  MISMATCH: "Payment issue",
  REJECTED: "Payment issue",
  VERIFIED: "Payment verified",
  EXPIRED: "Payment window passed",
  REFUND_PENDING: "Refund in progress",
  REFUNDED: "Refunded",
};
/** Statuses where the customer still has to pay (the amount, tabs and QR are shown). */
const TO_PAY = ["AWAITING_PAYMENT", "EXPIRED"];

/**
 * Browser Purchase for an advance order: at the first payment proof or the switch to COD (the thank-you page skips
 * advance orders). Same event_id as the server job (the order number), so Meta/TikTok count it once; once per browser.
 */
function firePayPurchase(info: PayInfo) {
  const flag = `zm_purchase_fired_${info.orderNumber}`;
  try {
    if (localStorage.getItem(flag)) return;
  } catch {}
  void trackStoreEvent(
    "Purchase",
    { content_type: "product", value: Number(info.total), currency: "PKR", order_id: info.orderNumber },
    {
      eventId: info.orderNumber,
      onMetaDelivered: () => {
        try {
          localStorage.setItem(flag, "1");
        } catch {}
      },
    },
  ).catch(() => undefined);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some in-app webviews: a hidden textarea and the legacy copy command.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function PayView({ orderNumber }: { orderNumber: string }) {
  const token = useSearchParams().get("t") || "";
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [tab, setTab] = useState<"till" | "qr">("till");
  const [toast, setToast] = useState("");
  const [help, setHelp] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState("");
  const [proofOpen, setProofOpen] = useState(false);
  const [proofSent, setProofSent] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const api = `/api/store-proxy/api/pay/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    try {
      const response = await fetch(api, { cache: "no-store" });
      if (response.status === 404) return setState("missing");
      if (!response.ok) return setState("error");
      const data = (await response.json()) as PayInfo;
      // Phones open on the Easypaisa Till tab; a computer shows the QR to scan with the phone.
      setTab(window.matchMedia("(min-width: 900px)").matches ? "qr" : "till");
      setInfo(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [api]);
  useEffect(() => {
    if (token) void load();
    else setState("missing");
  }, [load, token]);

  const flash = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  };
  const copy = async (text: string, label: string) => flash((await copyText(text)) ? `${label} copied` : "Copy failed – please copy it by hand");

  async function saveQr() {
    if (!info) return;
    // A cross-site image ignores the download attribute, so fetch it and save the same bytes.
    try {
      const blob = await (await fetch(info.qrUrl, { mode: "cors" })).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zelvomart-raast-qr.${blob.type.includes("jpeg") ? "jpg" : "png"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      window.open(info.qrUrl, "_blank", "noopener");
    }
  }

  async function switchToCod() {
    if (!info || switching) return;
    if (!window.confirm("Pay cash on delivery instead? The advance payment discount will be removed.")) return;
    setSwitching(true);
    setMessage("");
    try {
      const response = await fetch(api.replace("?t=", "/cod?t="), { method: "POST" });
      if (!response.ok) throw new Error();
      const next = (await response.json()) as PayInfo;
      setInfo(next);
      firePayPurchase(next);
      setMessage("Done – your order is now Cash on Delivery.");
    } catch {
      setMessage("We could not switch this order. Please message us on WhatsApp.");
    } finally {
      setSwitching(false);
    }
  }

  if (state === "loading") return <div className="container skeleton-block" aria-busy="true" />;
  if (state !== "ready" || !info)
    return (
      <section className="section">
        <div className={`container ${styles.narrow}`}>
          <div className={styles.card}>
            <h1 className={styles.title}>{state === "missing" ? "This payment link is not valid" : "Something went wrong"}</h1>
            <p>
              {state === "missing"
                ? "Open the link from your order email or the order page, or message us with your order number."
                : "Please refresh the page in a moment."}
            </p>
            <a className="btn wa" href={waLink(site.whatsappNumber, `Hi Zelvomart! I need help paying for order ${orderNumber}.`)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> WhatsApp us
            </a>
          </div>
        </div>
      </section>
    );

  const amount = money(info.total);
  const whatsapp = info.whatsapp || site.whatsappNumber;
  const helpLink = waLink(whatsapp, `Hi Zelvomart! Question about paying for order ${info.orderNumber}.`);
  const proofLink = waLink(whatsapp, `Hi Zelvomart! I have paid ${amount} for order ${info.orderNumber}. Here is my payment screenshot and TID:`);
  const isCod = info.paymentMethod === "COD";
  const toPay = !isCod && TO_PAY.includes(info.paymentStatus);
  /** A mismatch or rejection the customer can still answer with one corrected proof. */
  const toFix = !isCod && !toPay && info.canSubmitProof;
  const proofForm = (
    <PayProofForm
      info={info}
      api={api}
      method={tab === "qr" ? "RAAST_QR" : "TILL"}
      onDone={(next) => {
        setInfo(next);
        firePayPurchase(next);
        setProofOpen(false);
        setProofSent(true);
        setMessage("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );

  return (
    <section className="section pt-sm">
      <div className={`container ${styles.narrow}`}>
        {info.demo && (
          <p className={styles.demo} role="note">
            <TriangleAlert size={16} aria-hidden="true" /> DEMO – do not send money. These payment details are for testing only.
          </p>
        )}

        <header className={styles.head}>
          <div>
            <span className={styles.order}>Order {info.orderNumber}</span>
            <h1 className={styles.title}>{isCod ? "Cash on Delivery" : info.firstName ? `Thanks, ${info.firstName}` : "Complete your payment"}</h1>
          </div>
          <span className={`${styles.badge} ${isCod ? styles.badgeCod : ""}`}>{isCod ? "Pay on delivery" : BADGES[info.paymentStatus] || "Awaiting payment"}</span>
          <button className={styles.helpBtn} type="button" onClick={() => setHelp(true)} aria-label="How to pay">
            <CircleHelp size={20} />
          </button>
        </header>

        {message && (
          <p className={styles.notice} role="status">
            {message}
          </p>
        )}

        {isCod ? (
          <div className={styles.card}>
            <p>
              <Banknote size={18} aria-hidden="true" /> Pay <strong>{amount}</strong> in cash when your parcel arrives. We&apos;ll call or WhatsApp you to confirm before dispatch.
            </p>
            <Link className="btn" href="/track-your-order/">
              Track your order
            </Link>
          </div>
        ) : toPay ? (
          <>
            <div className={styles.amountBox}>
              <span>Send exactly</span>
              <strong>{amount}</strong>
              <button type="button" className={styles.copy} onClick={() => copy(String(Math.round(info.total)), "Amount")}>
                <Copy size={15} /> Copy amount
              </button>
              <small lang="ur-Latn">Bilkul yehi raqam bhejein: {amount}</small>
            </div>
            <p className={styles.merchant}>
              Merchant name in your app: <strong>{info.accountName}</strong>. If you see any other name, don&apos;t pay and{" "}
              <a href={helpLink} target="_blank" rel="noopener noreferrer">
                message us on WhatsApp
              </a>
              .
            </p>

            <div className={styles.tabs} role="tablist" aria-label="How to pay">
              <button role="tab" type="button" aria-selected={tab === "till"} className={tab === "till" ? styles.active : ""} onClick={() => setTab("till")}>
                <Smartphone size={16} /> Easypaisa Till
              </button>
              <button role="tab" type="button" aria-selected={tab === "qr"} className={tab === "qr" ? styles.active : ""} onClick={() => setTab("qr")}>
                Any bank app / JazzCash (Raast QR)
              </button>
            </div>

            {tab === "till" ? (
              <div className={styles.panel} role="tabpanel">
                <div className={styles.till}>
                  <span>Till ID</span>
                  <strong>{info.tillId}</strong>
                  <button type="button" className={styles.copy} onClick={() => copy(info.tillId, "Till ID")}>
                    <Copy size={15} /> Copy Till ID
                  </button>
                </div>
                <ol className={styles.steps}>
                  <li>Open Easypaisa → More → Till Payment</li>
                  <li>Paste the Till ID</li>
                  <li>Enter {amount}</li>
                  <li>Pay now, then keep the receipt screenshot</li>
                </ol>
              </div>
            ) : (
              <div className={styles.panel} role="tabpanel">
                <p className={styles.desktopOnly}>Scan with your phone&apos;s banking app</p>
                {/* Shown exactly as uploaded: no resizing service, crop or overlay, so the QR stays scannable. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.qr} src={info.qrUrl} alt={`Raast QR for ${info.accountName}`} width={320} height={361} />
                <button type="button" className={styles.copy} onClick={() => void saveQr()}>
                  <Download size={15} /> Save QR to gallery
                </button>
                <small className={styles.hint}>On iPhone: press and hold the QR → Save to Photos.</small>
                <ol className={styles.steps}>
                  <li>Open your bank app → Scan QR</li>
                  <li>Choose Gallery / Upload photo and pick the saved QR</li>
                  <li>Enter {amount} and pay</li>
                </ol>
                <small className={styles.hint}>If your app has no Gallery option, use the Easypaisa Till tab.</small>
              </div>
            )}

            {proofOpen && info.canSubmitProof ? (
              proofForm
            ) : null}
            <div className={styles.actions}>
              {!proofOpen && (
                <button className="btn block lg" type="button" onClick={() => setProofOpen(true)} disabled={!info.canSubmitProof}>
                  I&apos;ve paid – add proof
                </button>
              )}
              {proofOpen && (
                <a className={styles.linkBtn} href={proofLink} target="_blank" rel="noopener noreferrer">
                  Trouble uploading? Send it on WhatsApp
                </a>
              )}
              {info.canSwitchToCod && (
                <button type="button" className={styles.linkBtn} disabled={switching} onClick={() => void switchToCod()}>
                  {switching ? "Switching…" : "Pay on delivery instead"}
                </button>
              )}
            </div>
          </>
        ) : toFix ? (
          <>
            <div className={`${styles.card} ${styles.issue}`} role="status">
              <p>
                <TriangleAlert size={18} aria-hidden="true" />
                <span>
                  <strong>We need a quick check on your payment.</strong>{" "}
                  {info.proof?.rejectMessage ||
                    `You entered ${money(info.proof?.amountSent || 0)}, but your order total is ${amount}. If you sent a different amount, add a corrected proof or message us on WhatsApp.`}
                </span>
              </p>
              <p className={styles.formHint}>You can send one corrected proof.</p>
              {!proofOpen && (
                <button className="btn block" type="button" onClick={() => setProofOpen(true)}>
                  Send a corrected proof
                </button>
              )}
            </div>
            {proofOpen && proofForm}
            <p className={styles.center}>
              <a href={helpLink} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> WhatsApp help
              </a>
            </p>
          </>
        ) : (
          <div className={`${styles.card} ${proofSent ? styles.success : ""}`} role={proofSent ? "status" : undefined}>
            <p className={styles.textBlock}>
              <strong>Order received – advance payment {info.paymentStatus === "VERIFIED" ? "verified" : "pending verification"}.</strong>{" "}
              {info.paymentStatus === "VERIFIED"
                ? "Thank you! Your order is being packed."
                : `We verify during ${info.verificationHours} and confirm on WhatsApp/email. Your order is safe.`}
            </p>
            <a className="btn wa" href={helpLink} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> WhatsApp help
            </a>
          </div>
        )}

        <aside className={styles.trust} aria-label="Why pay in advance">
          <p>
            <ShieldCheck size={16} aria-hidden="true" /> <strong>Why pay in advance?</strong> {info.advanceDiscount > 0 ? `You save ${money(info.advanceDiscount)} and your order is packed first.` : "Your order is packed first."}
          </p>
          <p>
            If we can&apos;t ship your order, or you cancel before dispatch, the full amount is returned to the same account.{" "}
            <Link href={info.refundPolicyPath}>Refund policy</Link>
          </p>
          <p>
            <a href={helpLink} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> WhatsApp support
            </a>
          </p>
          <p className={styles.never}>We will never ask for your PIN, OTP or password.</p>
        </aside>
      </div>

      {help && (
        <div className={styles.sheetBackdrop} onClick={() => setHelp(false)}>
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="pay-help-title" onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHead}>
              <h2 id="pay-help-title">How to pay</h2>
              <button type="button" onClick={() => setHelp(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <ol className={styles.steps}>
              <li>
                Copy the amount and the Till ID (or save the QR).
                <small lang="ur-Latn">Raqam aur Till ID copy karein (ya QR save karein).</small>
              </li>
              <li>
                Open Easypaisa, JazzCash or your bank app and pay exactly {amount} to {info.accountName}.
                <small lang="ur-Latn">App kholein aur bilkul {amount} {info.accountName} ko bhejein.</small>
              </li>
              <li>
                Take a screenshot of the receipt and note the TID (transaction ID).
                <small lang="ur-Latn">Receipt ka screenshot lein aur TID likh lein.</small>
              </li>
              <li>
                Tap &ldquo;I&apos;ve paid – add proof&rdquo;. We check the payment before dispatch.
                <small lang="ur-Latn">&ldquo;I&apos;ve paid&rdquo; dabayein. Dispatch se pehle hum payment check karte hain.</small>
              </li>
            </ol>
            <p>
              <strong>Why advance payment?</strong> {info.advanceDiscount > 0 ? `You save ${money(info.advanceDiscount)} and your order is packed first.` : "Your order is packed first."}
            </p>
            <p>
              If we can&apos;t ship your order, or you cancel before dispatch, the full amount is returned to the same account. <Link href={info.refundPolicyPath}>Refund policy</Link>
            </p>
          </div>
        </div>
      )}

      <div className={`${styles.toast} ${toast ? styles.toastOn : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
}
