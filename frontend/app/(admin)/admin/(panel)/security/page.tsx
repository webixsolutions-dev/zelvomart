"use client";
import "@/components/admin/catalog-pages.css";
import { FormEvent, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { useAdminData, AdminLoading, AdminError } from "@/components/admin/useAdminData";

type Me = { user: { id: string; name: string; email: string; role: string }; twoFactorReady: boolean };
type Setup = { qr: string; secret: string };

const PASSWORD_MIN = 10;
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The signed-in admin's own security: optional two-factor sign-in and password change. */
export default function Security() {
  const { data, loading, error } = useAdminData<Me | null>("/api/auth/me", null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [twoFactor, setTwoFactor] = useState<boolean | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  if (loading) return <AdminLoading />;
  if (error || !data) return <AdminError message={error || "Could not load your account."} />;
  const on = twoFactor ?? data.twoFactorReady;

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      setSetup(await clientApi<Setup>("/api/auth/2fa/setup", { method: "POST" }, true));
    } catch (e) {
      setMessage(errorText(e, "Could not start set-up."));
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
      setTwoFactor(true);
      setSetup(null);
      setMessage("Two-factor sign-in is on. You will be asked for a code at your next sign-in.");
    } catch (err) {
      setMessage(errorText(err, "That code didn’t work."));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const password = String(new FormData(e.currentTarget).get("password") || "");
    try {
      await clientApi("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) }, true);
      setTwoFactor(false);
      setTurningOff(false);
      setMessage("Two-factor sign-in is off. Your password alone signs you in now.");
    } catch (err) {
      setMessage(errorText(err, "Could not turn off two-factor sign-in."));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get("currentPassword") || "");
    const newPassword = String(values.get("newPassword") || "");
    if (newPassword.length < PASSWORD_MIN) return setPasswordMessage(`The new password needs at least ${PASSWORD_MIN} characters.`);
    if (newPassword !== String(values.get("confirmPassword") || "")) return setPasswordMessage("The two new passwords don’t match.");
    setPasswordBusy(true);
    setPasswordMessage("");
    try {
      await clientApi("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }, true);
      form.reset();
      setPasswordMessage("Password changed. You stay signed in here; every other device has been signed out.");
    } catch (err) {
      setPasswordMessage(errorText(err, "Could not change the password."));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="admin-catalog-page">
      <div className="admin-title">
        <div>
          <h1>Security</h1>
          <p>Your password and optional two-factor sign-in. Sessions last 2 hours and renew while you work.</p>
        </div>
      </div>

      <div className="admin-settings-card" style={{ maxWidth: 560 }}>
        <h2>Change password</h2>
        <form className="admin-reference-form catalog-form" onSubmit={changePassword}>
          <label className="field">
            <span>Current password</span>
            <input name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label className="field">
            <span>New password</span>
            <input name="newPassword" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={200} required />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={200} required />
          </label>
          <p style={{ gridColumn: "1 / -1" }}>At least {PASSWORD_MIN} characters. Changing it signs you out on every other device.</p>
          <button className="admin-reference-submit" disabled={passwordBusy}>{passwordBusy ? "Saving…" : "Change password"}</button>
        </form>
        {passwordMessage ? <p role="status">{passwordMessage}</p> : null}
      </div>

      <div className="admin-settings-card" style={{ maxWidth: 560 }}>
        <h2>Two-factor sign-in</h2>
        <p>Optional. After your password, you also enter a 6-digit code from an authenticator app on your phone.</p>
        {on ? (
          turningOff ? (
            <form className="admin-reference-form catalog-form" onSubmit={turnOff}>
              <label className="field">
                <span>Current password</span>
                <input name="password" type="password" autoComplete="current-password" required autoFocus />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="admin-reference-submit" disabled={busy}>{busy ? "Turning off…" : "Turn off two-factor"}</button>
                <button type="button" className="admin-btn" onClick={() => setTurningOff(false)} disabled={busy}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <p>
                <strong>On.</strong> You will be asked for a code each time you sign in. If you lose your phone, an owner can reset it in Users &amp; Roles.
              </p>
              <button className="admin-btn" onClick={() => { setTurningOff(true); setMessage(""); }}>Turn off two-factor</button>
            </>
          )
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
            <p><strong>Off.</strong> Recommended for every account that can see customer details.</p>
            <button className="admin-btn" onClick={start} disabled={busy}>{busy ? "Starting…" : "Set up two-factor sign-in"}</button>
          </>
        )}
        {message ? <p role="status">{message}</p> : null}
      </div>
    </div>
  );
}
