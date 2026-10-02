"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, setAdminSession } from "@/lib/client-api";
import { clearAdminDataCache } from "@/components/admin/useAdminData";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.5 10.5 0 0 1 12 4c5.4 0 9 5.5 9 5.5a16 16 0 0 1-3.1 3.5M6.3 6.3C4.2 7.8 3 9.5 3 9.5S6.6 15 12 15c1 0 2-.2 2.9-.5"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.6-5.5 9-5.5 9 5.5 9 5.5-3.6 5.5-9 5.5S3 12 3 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
  );
}

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await clientApi<{ token: string; user: unknown }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      clearAdminDataCache();
      setAdminSession(r.token, r.user);
      router.replace("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-mark">Z</span>
          <div><b>ZELVOMART</b><small>ADMIN PORTAL</small></div>
        </div>

        <div className="admin-login-copy">
          <span>Store Management</span>
          <h1>Sign in to admin</h1>
          <p>Email and password only. Authentication is handled by the separate backend.</p>
        </div>

        <form className="admin-login-form" onSubmit={submit}>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>
            Password
            <span className="admin-password-wrap">
              <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </span>
          </label>
          {error ? <div className="field-error">{error.replace(/_/g, " ")}</div> : null}
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
