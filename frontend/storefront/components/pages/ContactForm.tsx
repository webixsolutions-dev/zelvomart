"use client";

import { useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { site } from "@store/lib/site";
import { waLink } from "@store/lib/format";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";
import s from "./Contact.module.css";

export const topics = ["Product question", "Order update", "Delivery question", "Returns & exchanges", "Something else"] as const;
type Topic = (typeof topics)[number];

const hints: Record<Topic, string> = {
  "Product question": "Have a product in mind? Add its name or link below.",
  "Order update": "Include your order number so we can find your order.",
  "Delivery question": "Tell us your city and add an order number if you have one.",
  "Returns & exchanges": "Add your order number and describe what you need help with.",
  "Something else": "Share a little detail below, and we’ll guide you.",
};

const TOPIC_EVENT = "zm:contact-topic";

/** Quick-help card that fills in the form's topic and moves to the form. */
export function TopicLink({ topic, className, children }: { topic: Topic; className?: string; children: React.ReactNode }) {
  return (
    <a
      className={className}
      href="#contact-form"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(TOPIC_EVENT, { detail: topic }));
      }}
    >
      {children}
    </a>
  );
}

type Values = { name: string; phone: string; topic: Topic; order: string; message: string };
type Errors = Partial<Record<"name" | "phone" | "message", string>>;

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Please enter your name.";
  const digits = v.phone.replace(/\D/g, "");
  if (!/^\+?[\d\s()-]+$/.test(v.phone.trim()) || digits.length < 10 || digits.length > 15) e.phone = "Please enter a valid mobile number.";
  if (v.message.trim().length < 5) e.message = "Please add a little detail about your question.";
  return e;
}

function compose(v: Values) {
  return [
    "Hi Zelvomart!",
    "",
    `Name: ${v.name.trim()}`,
    `Mobile: ${v.phone.trim()}`,
    `Topic: ${v.topic}`,
    ...(v.order.trim() ? [`Order number: ${v.order.trim()}`] : []),
    "",
    v.message.trim(),
  ].join("\n");
}

/**
 * No backend: nothing is sent to a server or saved. "Continue to WhatsApp" opens WhatsApp with the message
 * written out, and the email alternative opens the same message in the visitor's email app.
 */
export function ContactForm() {
  const [v, setV] = useState<Values>({ name: "", phone: "", topic: "Product question", order: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const topicRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const onTopic = (e: Event) => {
      const t = (e as CustomEvent<Topic>).detail;
      if (topics.includes(t)) {
        setV((x) => ({ ...x, topic: t }));
        setTimeout(() => topicRef.current?.focus({ preventScroll: true }), 400);
      }
    };
    window.addEventListener(TOPIC_EVENT, onTopic);
    return () => window.removeEventListener(TOPIC_EVENT, onTopic);
  }, []);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV({ ...v, [k]: e.target.value });
    if (k in errors) setErrors({ ...errors, [k]: undefined });
  };

  const check = () => {
    const e = validate(v);
    setErrors(e);
    const first = (["name", "phone", "message"] as const).find((k) => e[k]);
    if (first) {
      document.getElementById(`contact-${first}`)?.focus();
      setStatus("Please check the highlighted fields.");
      return false;
    }
    return true;
  };

  const toWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!check()) return;
    window.open(waLink(site.whatsappNumber, compose(v)), "_blank", "noopener");
    setStatus("WhatsApp opened in a new tab. Tap Send there to finish.");
  };

  const toEmail = () => {
    if (!check()) return;
    const subject = `${v.topic}${v.order.trim() ? ` — ${v.order.trim()}` : ""}`;
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(compose(v))}`;
    setStatus("Your email app should open with the message ready to send.");
  };

  const err = (k: keyof Errors) =>
    errors[k] ? (
      <span className={s.error} id={`contact-${k}-error`}>
        {errors[k]}
      </span>
    ) : null;

  return (
    <form className={s.form} onSubmit={toWhatsApp} noValidate>
      <div className={s.fields}>
        <div className={s.field}>
          <label htmlFor="contact-name">
            Full name <span aria-hidden="true">*</span>
          </label>
          <input
            id="contact-name"
            className={errors.name ? s.invalid : undefined}
            value={v.name}
            onChange={set("name")}
            placeholder="Your name"
            autoComplete="name"
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {err("name")}
        </div>
        <div className={s.field}>
          <label htmlFor="contact-phone">
            Mobile number <span aria-hidden="true">*</span>
          </label>
          <input
            id="contact-phone"
            className={errors.phone ? s.invalid : undefined}
            type="tel"
            inputMode="tel"
            value={v.phone}
            onChange={set("phone")}
            placeholder="03XX XXXXXXX"
            autoComplete="tel"
            required
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "contact-phone-error" : undefined}
          />
          {err("phone")}
        </div>
        <div className={s.field}>
          <label htmlFor="contact-topic">How can we help?</label>
          <select id="contact-topic" ref={topicRef} value={v.topic} onChange={set("topic")}>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor="contact-order">
            Order number <span className={s.optional}>(optional)</span>
          </label>
          <input id="contact-order" value={v.order} onChange={set("order")} placeholder="e.g. ZM-10004" autoComplete="off" spellCheck={false} />
        </div>
        <p className={s.topicHint} aria-live="polite">
          {hints[v.topic]}
        </p>
        <div className={`${s.field} ${s.full}`}>
          <label htmlFor="contact-message">
            Your message <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="contact-message"
            className={errors.message ? s.invalid : undefined}
            rows={5}
            value={v.message}
            onChange={set("message")}
            placeholder="Tell us how we can help…"
            required
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "contact-message-error" : undefined}
          />
          {err("message")}
        </div>
      </div>

      <button className={`btn wa block lg ${s.submit}`} type="submit">
        <WhatsAppIcon size={19} /> Continue to WhatsApp
      </button>
      <p className={s.formNote}>Your message opens in WhatsApp. Tap Send there to finish.</p>
      <button className={s.emailAlt} type="button" onClick={toEmail}>
        <Mail size={16} /> Prefer email? Open this message in your email app
      </button>
      <p className={s.status} role="status">
        {status}
      </p>
      <p className={s.privacy}>
        Nothing is sent or saved by this form. Please share order details only, never passwords or OTPs.{" "}
        <Link href="/privacy-policy/">Privacy policy</Link>
      </p>
    </form>
  );
}
