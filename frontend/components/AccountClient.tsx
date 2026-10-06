"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StoreUser = { id: string; name: string; email: string; createdAt?: string };
type Mode = "login" | "signup";

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  EMAIL_IN_USE: "An account with this email already exists.",
  INVALID_NAME: "Please enter your full name.",
  INVALID_EMAIL: "Please enter a valid email address.",
  PASSWORD_REQUIREMENTS: "Password must be at least 8 characters.",
  AUTH_BACKEND_UNAVAILABLE: "Account service is temporarily unavailable. Please try again.",
};

export default function AccountClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState<StoreUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/account/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json();
        return body.user as StoreUser;
      })
      .then((next) => { if (alive) setUser(next); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (mode === "signup" && password !== String(form.get("confirmPassword") || "")) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }
    const payload = mode === "signup"
      ? { name: String(form.get("name") || "").trim(), email: String(form.get("email") || "").trim(), password }
      : { email: String(form.get("email") || "").trim(), password };
    try {
      const response = await fetch(`/api/account/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(messages[String(body.error || "")] || "Unable to continue. Please try again.");
        return;
      }
      setUser(body.user);
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    setSubmitting(true);
    try { await fetch("/api/account/logout", { method: "POST" }); } finally {
      setUser(null);
      setSubmitting(false);
      router.refresh();
    }
  }

  if (checking) return <div className="zm-account-loading"><span className="zm-account-spinner" />Checking your account…</div>;

  if (user) {
    return (
      <div className="zm-account-card zm-account-profile">
        <span className="mock-eyebrow">MY ACCOUNT</span>
        <h1>Welcome, {user.name}.</h1>
        <p>You are signed in. Your session stays active securely on this device.</p>
        <dl>
          <div><dt>Name</dt><dd>{user.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
        </dl>
        <div className="zm-account-actions">
          <button type="button" onClick={() => router.push("/shop")}>Continue shopping</button>
          <button type="button" className="secondary" onClick={logout} disabled={submitting}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="zm-account-card">
      <span className="mock-eyebrow">ZELVOMART ACCOUNT</span>
      <h1>{mode === "login" ? "Sign in to your account." : "Create your account."}</h1>
      <p>{mode === "login" ? "Use your email and password to continue." : "Create an account for a faster, persistent sign-in experience."}</p>
      <div className="zm-account-tabs" role="tablist" aria-label="Account access">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Login</button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Sign up</button>
      </div>
      <form onSubmit={submit} className="zm-account-form">
        {mode === "signup" ? <label><span>Full name</span><input name="name" type="text" autoComplete="name" minLength={2} maxLength={80} required /></label> : null}
        <label><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
        <label><span>Password</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} required /></label>
        {mode === "signup" ? <label><span>Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label> : null}
        {error ? <div className="zm-account-error" role="alert">{error}</div> : null}
        <button type="submit" className="zm-account-submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "login" ? "Login" : "Create account"}</button>
      </form>
    </div>
  );
}
