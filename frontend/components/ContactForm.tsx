"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "sending" | "success" | "error";

export default function ContactForm({ whatsapp }: { whatsapp: string }) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      problem: String(data.get("problem") || "").trim(),
      website: String(data.get("website") || "").trim(),
    };

    if (!payload.name || !payload.email || !payload.phone || !payload.problem) {
      setState("error");
      setMessage("Please complete all fields so our team can help properly.");
      return;
    }

    setState("sending");
    setMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Unable to send your message right now.");
      form.reset();
      setState("success");
      setMessage("Thanks — your message has been sent. Our team will get back to you as soon as possible.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to send your message right now.");
    }
  }

  const cleanWhatsapp = whatsapp.replace(/\D/g, "") || "923002026711";

  return (
    <form className="premium-contact-form" onSubmit={submit} noValidate>
      <div className="premium-contact-form-head">
        <span className="premium-overline">SEND A MESSAGE</span>
        <h2>Tell us what you need help with.</h2>
        <p>Share a few details and the Zelvomart team can respond with the right product, order or delivery guidance.</p>
      </div>

      <div className="premium-form-grid">
        <label>
          <span>Name</span>
          <input name="name" autoComplete="name" maxLength={100} placeholder="Your full name" required />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" maxLength={160} placeholder="you@example.com" required />
        </label>
        <label>
          <span>Phone number</span>
          <input name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="03xx xxxxxxx" required />
        </label>
        <label className="premium-form-honeypot" aria-hidden="true">
          <span>Website</span>
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <label className="premium-form-wide">
          <span>Problem / message</span>
          <textarea name="problem" rows={6} maxLength={2000} placeholder="Tell us about the product, order or issue you need help with..." required />
        </label>
      </div>

      <div className="premium-contact-form-actions">
        <button type="submit" className="premium-button premium-button-dark" disabled={state === "sending"}>
          {state === "sending" ? "Sending..." : "Send message"} <span aria-hidden="true">→</span>
        </button>
        <a className="premium-contact-secondary" href={`https://wa.me/${cleanWhatsapp}`} target="_blank" rel="noreferrer">
          Prefer WhatsApp? Chat directly <span aria-hidden="true">→</span>
        </a>
      </div>

      {message ? <p className={`premium-form-status ${state === "success" ? "is-success" : "is-error"}`} role="status">{message}</p> : null}
    </form>
  );
}
