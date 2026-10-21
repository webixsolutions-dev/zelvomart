"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Mail } from "lucide-react";
import { trackStoreEvent } from "@/lib/client-tracking";
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

type Values = { name: string; phone: string; email: string; topic: Topic; order: string; message: string; website: string };
type Errors = Partial<Record<"name" | "phone" | "email" | "message", string>>;

function validate(v: Values, needEmail = true): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Please enter your name.";
  const digits = v.phone.replace(/\D/g, "");
  if (!/^\+?[\d\s()-]+$/.test(v.phone.trim()) || digits.length < 10 || digits.length > 15) e.phone = "Please enter a valid mobile number.";
  if (needEmail && !/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "Please enter a valid email address, so we can reply.";
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

/** What the support inbox receives: topic, order number (if any), then the message. */
function problem(v: Values) {
  return [`Topic: ${v.topic}`, ...(v.order.trim() ? [`Order number: ${v.order.trim()}`] : []), "", v.message.trim()].join("\n");
}

/** The backend's own wording for each refusal (POST /api/contact). */
const backendMessages: Record<string, string> = {
  INVALID_NAME: "Please enter your name.",
  INVALID_EMAIL: "Please enter a valid email address.",
  INVALID_PHONE: "Please enter a valid phone number.",
  INVALID_MESSAGE: "Please add a little more detail about the problem.",
  CONTACT_DELIVERY_FAILED: "We could not send your message right now. Please use WhatsApp or try again shortly.",
  RATE_LIMITED: "You’ve sent several messages in a short time. Please wait a little, or message us on WhatsApp.",
};

/**
 * Sends the message to support@zelvomart.com through POST /api/contact (store proxy, so the
 * backend's rate limit sees the visitor's own address). WhatsApp stays available as the second option.
 */
export function ContactForm() {
  const [v, setV] = useState<Values>({ name: "", phone: "", email: "", topic: "Product question", order: "", message: "", website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);
  const topicRef = useRef<HTMLSelectElement>(null);
  const contactTracked = useRef(false);

  useEffect(() => {
    const onTopic = (e: Event) => {
      const t = (e as CustomEvent<Topic>).detail;
      if (topics.includes(t)) {
        setSent(null);
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

  const check = (needEmail: boolean) => {
    const e = validate(v, needEmail);
    setErrors(e);
    const first = (["name", "phone", "email", "message"] as const).find((k) => e[k]);
    if (first) {
      document.getElementById(`contact-${first}`)?.focus();
      setStatus("Please check the highlighted fields.");
      return false;
    }
    setStatus("");
    return true;
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure("");
    if (sending || !check(true)) return;
    setSending(true);
    try {
      const response = await fetch("/api/store-proxy/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), website: v.website, problem: problem(v) }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        setFailure(data.message || backendMessages[String(data.error)] || backendMessages.CONTACT_DELIVERY_FAILED);
        return;
      }
      if (!contactTracked.current) {
        contactTracked.current = true;
        trackStoreEvent("Contact", { content_name: "contact_form", content_category: v.topic }).catch(() => undefined);
      }
      setSent({ name: v.name.trim().split(/\s+/)[0], email: v.email.trim() });
    } catch {
      setFailure(backendMessages.CONTACT_DELIVERY_FAILED);
    } finally {
      setSending(false);
    }
  };

  const toWhatsApp = () => {
    if (!check(false)) return;
    window.open(waLink(site.whatsappNumber, compose(v)), "_blank", "noopener");
    setStatus("WhatsApp opened in a new tab. Tap Send there to finish.");
  };

  const err = (k: keyof Errors) =>
    errors[k] ? (
      <span className={s.error} id={`contact-${k}-error`}>
        {errors[k]}
      </span>
    ) : null;

  if (sent) {
    return (
      <div className={s.sent} role="status">
        <span className={s.sentIcon} aria-hidden="true">
          <CircleCheck size={30} />
        </span>
        <h3>Message sent.</h3>
        <p>
          Thanks, {sent.name}. We’ve received your message and will reply to <strong>{sent.email}</strong>, usually within a few hours.
        </p>
        <p className={s.sentAlt}>
          Need help sooner?{" "}
          <a href={waLink(site.whatsappNumber, compose(v))} target="_blank" rel="noopener noreferrer">
            Chat on WhatsApp
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={send} noValidate aria-busy={sending}>
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
        <div className={`${s.field} ${s.full}`}>
          <label htmlFor="contact-email">
            Email address <span aria-hidden="true">*</span>
          </label>
          <input
            id="contact-email"
            className={errors.email ? s.invalid : undefined}
            type="email"
            inputMode="email"
            value={v.email}
            onChange={set("email")}
            placeholder="you@example.com"
            autoComplete="email"
            required
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {err("email")}
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
        {/* Honeypot: people never see or fill it; bots usually do. */}
        <div className={s.honeypot} aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} />
        </div>
      </div>

      {failure && (
        <p className={s.failure} role="alert">
          {failure}{" "}
          <button type="button" onClick={toWhatsApp}>
            or send it on WhatsApp
          </button>
        </p>
      )}
      <button className={`btn block lg ${s.submit}`} type="submit" disabled={sending}>
        <Mail size={19} /> {sending ? "Sending…" : "Send message"}
      </button>
      <button className={s.emailAlt} type="button" onClick={toWhatsApp}>
        <WhatsAppIcon size={16} /> Prefer WhatsApp? Send this message on WhatsApp
      </button>
      <p className={s.status} role="status">
        {status}
      </p>
      <p className={s.privacy}>
        We use these details only to reply to your message. Please never share passwords or OTPs.{" "}
        <Link href="/privacy-policy/">Read our Privacy Policy.</Link>
      </p>
    </form>
  );
}
