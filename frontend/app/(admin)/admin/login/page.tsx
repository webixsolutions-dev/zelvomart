"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAdminDataCache } from "@/components/admin/useAdminData";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.5 10.5 0 0 1 12 4c5.4 0 9 5.5 9 5.5a16 16 0 0 1-3.1 3.5M6.3 6.3C4.2 7.8 3 9.5 3 9.5S6.6 15 12 15c1 0 2-.2 2.9-.5"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.6-5.5 9-5.5 9 5.5 9 5.5-3.6 5.5-9 5.5S3 12 3 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
  );
}

type Step =
  | { kind: "password" }
  | { kind: "verify"; challenge: string }
  | { kind: "enroll"; challenge: string; qr: string; secret: string };

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "That email and password don’t match.",
  INVALID_CODE: "That code didn’t work. Check the time on your phone and try the newest code.",
  CHALLENGE_EXPIRED: "That sign-in took too long. Enter your password again.",
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
  BACKEND_UNAVAILABLE: "The admin service is not reachable. Try again in a moment.",
};

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "password" });

  useEffect(() => {
    fetch('/api/admin-proxy/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => { if (response.ok) router.replace('/admin'); })
      .catch(() => undefined);
  }, [router]);

  async function send(url: string, body: Record<string, string>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = String(data?.error || "");
      if (code === "CHALLENGE_EXPIRED") setStep({ kind: "password" });
      throw new Error(MESSAGES[code] || data?.message || code || "Login failed");
    }
    return data as { user?: unknown; twoFactor?: "verify" | "enroll"; challenge?: string; qr?: string; secret?: string };
  }

  function signedIn() {
    clearAdminDataCache();
    router.replace("/admin");
    router.refresh();
  }

  async function submitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const data = await send('/api/admin-session/login', { email: String(f.get("email") || "").trim(), password: String(f.get("password") || "") });
      if (data.twoFactor === "verify" && data.challenge) setStep({ kind: "verify", challenge: data.challenge });
      else if (data.twoFactor === "enroll" && data.challenge) setStep({ kind: "enroll", challenge: data.challenge, qr: String(data.qr || ""), secret: String(data.secret || "") });
      else signedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step.kind === "password") return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await send('/api/admin-session/verify', { challenge: step.challenge, code: String(f.get("code") || "").replace(/\s/g, "") });
      signedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const codeField = (
    <label>
      6-digit code
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
    </label>
  );

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand admin-login-brand-real">
          <Image src="/images/zelvomart-logo.png" alt="Zelvomart" width={357} height={235} className="admin-login-logo-image" priority />
          <small>ADMIN PORTAL</small>
        </div>

        {step.kind === "password" && (
          <>
            <div className="admin-login-copy">
              <span>Store Management</span>
              <h1>Sign in to admin</h1>
              <p>Use your staff email and password. Owners and managers then enter a code from their authenticator app.</p>
            </div>
            <form className="admin-login-form" onSubmit={submitPassword}>
              <label>Email<input name="email" type="email" autoComplete="email" required /></label>
              <label>
                Password
                <span className="admin-password-wrap">
                  <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
                  <button type="button" className="admin-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                    <EyeIcon open={showPassword} />
                  </button>
                </span>
              </label>
              {error ? <div className="field-error">{error}</div> : null}
              <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          </>
        )}

        {step.kind === "verify" && (
          <>
            <div className="admin-login-copy">
              <span>Two-factor sign-in</span>
              <h1>Enter your code</h1>
              <p>Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and enter the 6-digit code for Zelvomart.</p>
            </div>
            <form className="admin-login-form" onSubmit={submitCode}>
              {codeField}
              {error ? <div className="field-error">{error}</div> : null}
              <button type="submit" disabled={busy}>{busy ? "Checking…" : "Verify and sign in"}</button>
              <button type="button" className="admin-login-back" onClick={() => { setError(""); setStep({ kind: "password" }); }}>Use a different account</button>
            </form>
          </>
        )}

        {step.kind === "enroll" && (
          <>
            <div className="admin-login-copy">
              <span>Set up two-factor sign-in</span>
              <h1>Protect your account</h1>
              <p>Owner and manager accounts need a second step. Scan this code with an authenticator app, then enter the 6-digit code it shows.</p>
            </div>
            <form className="admin-login-form" onSubmit={submitCode}>
              {step.qr ? <img className="admin-login-qr" src={step.qr} alt="QR code for your authenticator app" width={200} height={200} /> : null}
              <p className="admin-login-secret">Can’t scan? Enter this key: <code>{step.secret.replace(/(.{4})/g, "$1 ").trim()}</code></p>
              {codeField}
              {error ? <div className="field-error">{error}</div> : null}
              <button type="submit" disabled={busy}>{busy ? "Checking…" : "Turn on and sign in"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
