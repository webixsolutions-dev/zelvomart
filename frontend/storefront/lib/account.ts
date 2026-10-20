"use client";

/**
 * My Account sign-in and register, through the platform's /api/account routes
 * (they call /api/customer-auth/* on the backend and set the session cookie).
 */
type Toast = { title: string; body?: string };

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Please enter a valid email address.",
  INVALID_NAME: "Please enter your full name.",
  WEAK_PASSWORD: "Please choose a longer password.",
  EMAIL_IN_USE: "An account with this email already exists. Please log in.",
  INVALID_CREDENTIALS: "That email and password don’t match.",
  AUTH_BACKEND_UNAVAILABLE: "We couldn’t reach the account service. Please try again.",
};

export async function signIn(
  mode: "in" | "up" | "forgot",
  form: { name: string; email: string; login: string; password: string },
): Promise<Toast> {
  if (mode === "forgot") return { title: "If an account exists for that email, we’ll send a reset link." };
  const url = mode === "up" ? "/api/account/signup" : "/api/account/login";
  // The backend signs in by email; the login field accepts the email.
  const body = mode === "up" ? { name: form.name.trim(), email: form.email.trim(), password: form.password } : { email: form.login.trim(), password: form.password };
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = String(data.error || "");
      return { title: mode === "up" ? "We couldn’t create your account" : "We couldn’t log you in", body: MESSAGES[code] || "Please check your details and try again." };
    }
    const name = String(data.user?.name || "").split(/\s+/)[0];
    return {
      title: mode === "up" ? `Welcome to Zelvomart${name ? `, ${name}` : ""}!` : `You’re logged in${name ? `, ${name}` : ""}.`,
      body: "Your orders and saved details will appear here soon.",
    };
  } catch {
    return { title: "We couldn’t reach the account service", body: "Please try again in a moment." };
  }
}
