"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { money } from "@store/lib/format";
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

type Errors = Partial<
  Record<
    "screenshot" | "tid" | "amount" | "senderName" | "senderLast4" | "form",
    string
  >
>;

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
  const [amount, setAmount] = useState(String(Math.round(info.total)));
  const [senderName, setSenderName] = useState("");
  const [senderLast4, setSenderLast4] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
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
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function validate(): Errors {
    const found: Errors = {};
    const cleanTid = tid.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!file) found.screenshot = "Add the payment screenshot.";
    if (cleanTid.length < 6 || cleanTid.length > 40)
      found.tid = "Enter the transaction ID (TID) from your receipt.";
    if (!(Number(amount) > 0)) found.amount = "Enter the amount you sent.";
    if (senderName.trim().length < 2)
      found.senderName = "Enter the name on the account you paid from.";
    if (senderLast4 && !/^\d{4}$/.test(senderLast4))
      found.senderLast4 = "Enter exactly 4 digits, or leave it empty.";
    return found;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setSending(true);
    try {
      let image: Blob;
      try {
        image = await prepareScreenshot(file!);
      } catch {
        setErrors({
          screenshot:
            "This picture is too large. Send a normal screenshot instead.",
        });
        return;
      }
      const form = new FormData();
      form.set("method", method);
      form.set("tid", tid.trim());
      form.set("amount", amount);
      form.set("senderName", senderName.trim());
      if (senderLast4) form.set("senderLast4", senderLast4);
      form.set(
        "screenshot",
        image,
        image === file ? file!.name : "screenshot.jpg",
      );
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

  return (
    <form
      ref={formRef}
      className={`${styles.card} ${styles.proofForm}`}
      onSubmit={submit}
      noValidate
    >
      <h2 className={styles.formTitle}>Add your payment proof</h2>
      <p className={styles.formLead}>
        Send the receipt screenshot and the TID. We check every payment in our
        Easypaisa merchant account before dispatch.
      </p>
      <label className={styles.fileBox}>
        <input
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
            <ImagePlus size={22} aria-hidden="true" /> Choose screenshot *
            <small>JPG, PNG or WebP, up to 5 MB</small>
          </span>
        )}
      </label>
      {err("screenshot")}
      <div className="fields">
        <label>
          Transaction ID (TID) *
          <input
            value={tid}
            onChange={(e) => {
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
          Amount sent (Rs) *
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
              clear("amount");
            }}
            inputMode="decimal"
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
          Sender account name *
          <input
            value={senderName}
            onChange={(e) => {
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
        We will never ask for your PIN, OTP or password.
      </p>
    </form>
  );
}
