"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { money } from "@store/lib/format";
import { detailsRequired, proofErrors, type ProofErrors } from "@store/lib/proof-rules";
import styles from "./PayView.module.css";
import type { PayInfo } from "./PayView";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
/** Above this the file is made smaller on the phone first (the storefront proxy accepts about 4.5 MB per request). */
const SEND_AS_IS_BYTES = 3.5 * 1024 * 1024;
const MAX_SIDE = 2400;

/**
 * Large or huge screenshots are redrawn on the phone (same picture, no crop; EXIF dropped) so the upload stays small.
 * Anything already small goes as it is; the server cleans every file again either way.
 */
export async function prepareScreenshot(file: File): Promise<Blob> {
  if (file.size <= SEND_AS_IS_BYTES) {
    const bitmap = await createImageBitmap(file).catch(() => null);
    const small = !bitmap || Math.max(bitmap.width, bitmap.height) <= MAX_SIDE;
    bitmap?.close();
    if (small) return file;
  }
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= SEND_AS_IS_BYTES) return blob;
  }
  throw new Error("TOO_LARGE");
}

type Errors = ProofErrors;

/**
 * The payment proof: a screenshot alone is enough, or the TID and amount without one (lib/proof-rules.ts; the server
 * checks the same rule). With a screenshot the details are optional: auto-read fills the empty ones when it can and
 * whatever the customer types wins. The amount never starts as the order total, so a wrong or partial payment shows.
 */
export function PayProofForm({
  info,
  api,
  method,
  onDone,
}: {
  info: PayInfo;
  /** `/api/store-proxy/api/pay/ZM-…?t=…` */
  api: string;
  method: "TILL" | "RAAST_QR";
  onDone: (next: PayInfo) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [tid, setTid] = useState("");
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderLast4, setSenderLast4] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState("");
  const edited = useRef({ tid: false, amount: false, sender: false });
  /** The screenshot the latest auto-read belongs to (a removed or replaced one is ignored). */
  const readFor = useRef<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const required = detailsRequired(!!file);
  /** Typing in a field clears its message (and the form-level one). */
  const clear = (key: keyof Errors) =>
    setErrors((e) =>
      e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e,
    );

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function pick(next: File | undefined) {
    setErrors((e) => ({ ...e, screenshot: undefined, form: undefined }));
    if (!next) return;
    if (!TYPES.includes(next.type))
      return setErrors((e) => ({
        ...e,
        screenshot: "Choose a JPG, PNG or WebP screenshot.",
      }));
    if (next.size > MAX_BYTES)
      return setErrors((e) => ({
        ...e,
        screenshot: "The screenshot must be up to 5 MB.",
      }));
    clearAutoFill();
    setFile(next);
    setPreview(URL.createObjectURL(next));
    // A screenshot makes the details optional: clear their "required" messages.
    setErrors({});
    setReadNote("");
    if (info.autoRead) void autoFill(next);
  }

  function clearAutoFill() {
    readFor.current = null;
    setReading(false);
    if (!edited.current.tid) setTid("");
    if (!edited.current.amount) setAmount("");
    if (!edited.current.sender) setSenderName("");
  }

  function removeScreenshot() {
    clearAutoFill();
    setFile(null);
    setPreview("");
    setReadNote("");
    if (fileInput.current) fileInput.current.value = "";
  }

  /** Auto-read (when the shop turned it on): fills empty fields only; the customer checks and can change them. */
  async function autoFill(next: File) {
    readFor.current = next;
    setReading(true);
    let filled = false;
    try {
      const image = await prepareScreenshot(next);
      const form = new FormData();
      form.set(
        "screenshot",
        image,
        image === next ? next.name : "screenshot.jpg",
      );
      const response = await fetch(api.replace("?t=", "/proof/read?t="), {
        method: "POST",
        body: form,
      });
      const { prefill } = (await response.json().catch(() => ({}))) as {
        prefill?: {
          tid: string | null;
          amount: number | null;
          sender: string | null;
        } | null;
      };
      if (readFor.current !== next || !prefill) return;
      if (prefill.tid && !edited.current.tid) {
        setTid(prefill.tid);
        filled = true;
      }
      if (prefill.amount && !edited.current.amount) {
        setAmount(String(prefill.amount));
        filled = true;
      }
      if (prefill.sender && !edited.current.sender) {
        setSenderName(prefill.sender);
        filled = true;
      }
    } catch {
      // No hint: the customer types the details (or sends the screenshot alone).
    } finally {
      if (readFor.current === next) {
        setReading(false);
        setReadNote(
          filled
            ? "We filled in what we could read from your screenshot. Please check it."
            : "Please type the details from your receipt.",
        );
      }
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const found = proofErrors({
      hasScreenshot: !!file,
      tid,
      amount,
      senderName,
      senderLast4,
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSending(true);
    try {
      const form = new FormData();
      form.set("method", method);
      if (tid.trim()) form.set("tid", tid.trim());
      if (amount.trim()) form.set("amount", amount.trim());
      if (senderName.trim()) form.set("senderName", senderName.trim());
      if (senderLast4) form.set("senderLast4", senderLast4);
      if (file) {
        let image: Blob;
        try {
          image = await prepareScreenshot(file);
        } catch {
          setErrors({
            screenshot:
              "This picture is too large. Send a normal screenshot instead.",
          });
          return;
        }
        form.set(
          "screenshot",
          image,
          image === file ? file.name : "screenshot.jpg",
        );
      }
      const response = await fetch(api.replace("?t=", "/proof?t="), {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 429)
        return setErrors({
          form: "Too many tries. Please wait a few minutes and try again.",
        });
      if (!response.ok)
        return setErrors({
          form:
            data.message ||
            "We could not save your proof. Please try again or send it on WhatsApp.",
        });
      onDone(data as PayInfo);
    } catch {
      setErrors({ form: "No connection. Check your internet and try again." });
    } finally {
      setSending(false);
    }
  }

  const err = (key: keyof Errors) =>
    errors[key] && (
      <span className="field-error" id={`proof-err-${key}`}>
        {errors[key]}
      </span>
    );
  const described = (key: keyof Errors) =>
    errors[key]
      ? { "aria-invalid": true, "aria-describedby": `proof-err-${key}` }
      : {};
  /** The "*" sits in a fixed-width slot so labels never move when it comes and goes. */
  const mark = (on: boolean) => (
    <span className={styles.reqMark} aria-hidden="true">
      {on ? "*" : ""}
    </span>
  );

  return (
    <form
      ref={formRef}
      className={`${styles.card} ${styles.proofForm}`}
      onSubmit={submit}
      noValidate
    >
      <h2 className={styles.formTitle}>Add your payment proof</h2>
      <p className={styles.formLead}>
        Send the receipt screenshot, or the TID and amount. We check every
        payment in our Easypaisa merchant account before dispatch.
      </p>
      <div className={styles.fileWrap}>
        <label className={styles.fileBox}>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pick(e.target.files?.[0])}
            {...described("screenshot")}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Your payment screenshot"
              className={styles.preview}
            />
          ) : (
            <span className={styles.filePrompt}>
              <ImagePlus size={22} aria-hidden="true" /> Choose screenshot
              <small>JPG, PNG or WebP, up to 5 MB</small>
            </span>
          )}
        </label>
        {file && (
          <button
            type="button"
            className={styles.fileRemove}
            onClick={removeScreenshot}
            aria-label="Remove the screenshot"
          >
            <X size={16} aria-hidden="true" /> Remove
          </button>
        )}
      </div>
      {err("screenshot")}
      <p className={styles.formHint} role="status" aria-live="polite">
        {reading
          ? "Reading your screenshot…"
          : readNote ||
            (file
              ? "Uploaded a screenshot? These details are optional, we read them from the screenshot."
              : "No screenshot? Enter the TID and amount from your receipt.")}
      </p>
      <div className="fields">
        <label>
          <span>Transaction ID (TID) {mark(required)}</span>
          <input
            value={tid}
            onChange={(e) => {
              edited.current.tid = true;
              setTid(e.target.value);
              clear("tid");
            }}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="e.g. 41234567890"
            maxLength={60}
            {...described("tid")}
          />
          {err("tid")}
        </label>
        <label>
          <span>Amount sent (Rs) {mark(required)}</span>
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
              edited.current.amount = true;
              clear("amount");
            }}
            inputMode="decimal"
            placeholder="Type the exact amount you sent"
            {...described("amount")}
          />
          {Number(amount) > 0 && Math.abs(Number(amount) - info.total) >= 1 && (
            <span className="opt">
              Your order total is {money(info.total)}.
            </span>
          )}
          {err("amount")}
        </label>
        <label>
          <span>
            Sender account name <span className="opt">(recommended)</span>
          </span>
          <input
            value={senderName}
            onChange={(e) => {
              edited.current.sender = true;
              setSenderName(e.target.value);
              clear("senderName");
            }}
            autoComplete="name"
            placeholder="Name shown in your app"
            maxLength={80}
            {...described("senderName")}
          />
          {err("senderName")}
        </label>
        <label>
          Last 4 digits of your number <span className="opt">(optional)</span>
          <input
            value={senderLast4}
            onChange={(e) => {
              setSenderLast4(e.target.value.replace(/\D/g, "").slice(0, 4));
              clear("senderLast4");
            }}
            inputMode="numeric"
            placeholder="e.g. 4567"
            {...described("senderLast4")}
          />
          {err("senderLast4")}
        </label>
      </div>
      {errors.form && (
        <p className={styles.formError} role="alert">
          {errors.form}
        </p>
      )}
      <button className="btn block lg" type="submit" disabled={sending}>
        {sending ? (
          <>
            <Loader2 size={18} className={styles.spin} aria-hidden="true" />{" "}
            Sending…
          </>
        ) : (
          "Send payment proof"
        )}
      </button>
      <p className={styles.formHint}>
        <strong>We will never ask for your PIN, OTP or password.</strong>
      </p>
    </form>
  );
}
