"use client";
import "@/components/admin/catalog-pages.css";
import { FormEvent, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { useAdminData, AdminLoading, AdminError } from "@/components/admin/useAdminData";

type Me = { user: { id: string; name: string; email: string; role: string }; twoFactorReady: boolean };
type Setup = { qr: string; secret: string };

/** The signed-in admin's own security: optional two-factor sign-in. */
export default function Security() {
  const { data, loading, error } = useAdminData<Me | null>("/api/auth/me", null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  if (loading) return <AdminLoading />;
  if (error || !data) return <AdminError message={error || "Could not load your account."} />;
  const me = data.user;
  const on = enabled || data.twoFactorReady;

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      setSetup(await clientApi<Setup>("/api/auth/2fa/setup", { method: "POST" }, true));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not start set-up.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const code = String(new FormData(e.currentTarget).get("code") || "").replace(/\s/g, "");
    try {
      await clientApi("/api/auth/2fa/confirm", { method: "POST", body: JSON.stringify({ code }) }, true);
      setEnabled(true);
      setSetup(null);
      setMessage("Two-factor sign-in is on. You will be asked for a code at your next sign-in.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That code didn’t work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-catalog-page">
      <div className="admin-title">
        <div>
          <h1>Security</h1>
          <p>Two-factor sign-in asks for a 6-digit code from an authenticator app after your password. Sessions last 2 hours and renew while you work.</p>
        </div>
      </div>
      <div className="admin-settings-card" style={{ maxWidth: 560 }}>
        <h2>Two-factor sign-in</h2>
        {on ? (
          <p>
            <strong>On.</strong> You will be asked for a code each time you sign in. If you lose your phone, an owner can reset it in Users &amp; Roles.
          </p>
        ) : setup ? (
          <form className="admin-reference-form catalog-form" onSubmit={confirm}>
            <p>Scan this code with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.</p>
            <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} />
            <p>
              Can’t scan? Enter this key: <code>{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
            </p>
            <label className="field">
              <span>6-digit code</span>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus />
            </label>
            <button className="admin-reference-submit" disabled={busy}>{busy ? "Checking…" : "Turn on"}</button>
          </form>
        ) : (
          <>
            <p>Off. Recommended for every account that can see customer details.</p>
            <button className="admin-btn" onClick={start} disabled={busy}>{busy ? "Starting…" : "Set up two-factor sign-in"}</button>
          </>
        )}
        {message ? <p role="status">{message}</p> : null}
      </div>
    </div>
  );
}
