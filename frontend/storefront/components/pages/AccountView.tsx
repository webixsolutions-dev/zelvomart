"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  LockKeyhole,
  MailCheck,
  MapPin,
  Package,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Headset,
} from "lucide-react";
import { money, waLink } from "@store/lib/format";
import { site } from "@store/lib/site";
import { useShop } from "@store/lib/store";
import { signIn } from "@store/lib/account";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";

/** Live counts for the hero card — everything comes from this device's saved shop state. */
export function AccountSnapshot() {
  const { orders, wishlist, cartCount, ready } = useShop();
  const stats = [
    { label: "Orders", value: orders.length, icon: Package, href: "#acc-orders" },
    { label: "Wishlist", value: wishlist.length, icon: Heart, href: "/wishlist/" },
    { label: "In cart", value: cartCount, icon: ShoppingCart, href: "/cart/" },
  ];

  return (
    <aside className="acc-snapshot" aria-label="Your activity on this device">
      <div className="acc-snapshot-head">
        <span className="acc-avatar" aria-hidden="true">
          <ShoppingBag size={22} />
        </span>
        <div>
          <small>Your activity</small>
          <strong>Saved on this device</strong>
        </div>
      </div>
      <div className="acc-stats">
        {stats.map((s) => (
          <Link href={s.href} className="acc-stat" key={s.label}>
            <s.icon size={17} />
            <b>{ready ? s.value : "–"}</b>
            <span>{s.label}</span>
          </Link>
        ))}
      </div>
      <Link href="/shop-all-products/" className="btn secondary block">
        Continue shopping <ArrowRight size={16} />
      </Link>
    </aside>
  );
}

type AuthMode = "in" | "up" | "forgot";
type AuthForm = { name: string; phone: string; email: string; login: string; password: string };
const emptyAuth: AuthForm = { name: "", phone: "", email: "", login: "", password: "" };
const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
const isPkMobile = (v: string) => /^(\+92|0092|0)?3\d{9}$/.test(v.replace(/[\s-]/g, ""));

function validateAuth(mode: AuthMode, f: AuthForm) {
  const e: Partial<Record<keyof AuthForm, string>> = {};
  if (mode === "in") {
    if (!isEmail(f.login) && !isPkMobile(f.login)) e.login = "Enter your mobile number or email.";
    if (!f.password) e.password = "Enter your password.";
  }
  if (mode === "up") {
    if (f.name.trim().length < 3) e.name = "Please enter your full name.";
    if (!isPkMobile(f.phone)) e.phone = "Enter a valid Pakistani mobile number, e.g. 0300 1234567.";
    if (!isEmail(f.email)) e.email = "That email doesn't look right.";
    if (f.password.length < 6) e.password = "Use at least 6 characters.";
  }
  if (mode === "forgot" && !isEmail(f.email)) e.email = "That email doesn't look right.";
  return e;
}

export function AccountAuth() {
  const { notify } = useShop();
  const [mode, setMode] = useState<AuthMode>("in");
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState<AuthForm>(emptyAuth);
  const [errors, setErrors] = useState<Partial<Record<keyof AuthForm, string>>>({});
  const [resetSent, setResetSent] = useState(false);

  const switchTo = (m: AuthMode) => {
    setMode(m);
    setErrors({});
    setResetSent(false);
  };

  const field = (k: keyof AuthForm) => ({
    id: `acc-${k}`,
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm({ ...form, [k]: e.target.value });
      if (errors[k]) setErrors({ ...errors, [k]: undefined });
    },
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `acc-err-${k}` : undefined,
    className: `field ${errors[k] ? "has-error" : ""}`,
  });
  const err = (k: keyof AuthForm) =>
    errors[k] && (
      <span className="field-error" id={`acc-err-${k}`}>
        {errors[k]}
      </span>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateAuth(mode, form);
    setErrors(v);
    if (Object.keys(v).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".acc-auth [aria-invalid=true]")?.focus());
      return;
    }
    if (mode === "forgot") {
      // No backend yet: always show the same neutral message, so nobody can test which emails have accounts.
      setResetSent(true);
      return;
    }
    // Login and register go to the backend (/api/account/login, /api/account/signup → /api/customer-auth/*).
    void signIn(mode, form).then((r) => notify(r));
  };

  const password = (
    <label htmlFor="acc-password">
      <span className="acc-label-row">
        Password
        {mode === "in" && (
          <button type="button" className="acc-forgot" onClick={() => switchTo("forgot")}>
            Forgot password?
          </button>
        )}
      </span>
      <span className="acc-pw">
        <input
          {...field("password")}
          type={showPw ? "text" : "password"}
          placeholder={mode === "up" ? "At least 6 characters" : "••••••••"}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
        />
        <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {err("password")}
    </label>
  );

  return (
    <div className="acc-auth">
      {mode !== "forgot" && (
        <div className="acc-tabs" role="tablist" aria-label="Login or register">
          <button type="button" role="tab" aria-selected={mode === "in"} className={mode === "in" ? "active" : ""} onClick={() => switchTo("in")}>
            Login
          </button>
          <button type="button" role="tab" aria-selected={mode === "up"} className={mode === "up" ? "active" : ""} onClick={() => switchTo("up")}>
            Register
          </button>
        </div>
      )}

      <div className="acc-auth-head">
        <span className="acc-auth-ico">{mode === "forgot" ? <KeyRound size={20} /> : <LockKeyhole size={20} />}</span>
        <div>
          <h2>{mode === "in" ? "Welcome back" : mode === "up" ? "Create your account" : "Reset your password"}</h2>
          <p>
            {mode === "in"
              ? "Sign in to see your orders and saved items."
              : mode === "up"
                ? "Save your details for a faster checkout next time."
                : "Enter the email you signed up with and we’ll send you a link to set a new password."}
          </p>
        </div>
      </div>

      {mode === "forgot" && resetSent ? (
        <div className="acc-reset-done" role="status">
          <MailCheck size={20} />
          <p>If an account exists for that email, we’ll send a reset link.</p>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {mode === "in" && (
            <>
              <label htmlFor="acc-login">
                Mobile number or email
                <input {...field("login")} placeholder="03XX XXXXXXX or you@example.com" autoComplete="username" />
                {err("login")}
              </label>
              {password}
            </>
          )}
          {mode === "up" && (
            <>
              <label htmlFor="acc-name">
                Full name
                <input {...field("name")} placeholder="Your full name" autoComplete="name" />
                {err("name")}
              </label>
              <label htmlFor="acc-phone">
                Mobile number
                <input {...field("phone")} type="tel" inputMode="tel" placeholder="03XX XXXXXXX" autoComplete="tel" />
                {err("phone")}
              </label>
              <label htmlFor="acc-email">
                Email
                <input {...field("email")} type="email" placeholder="you@example.com" autoComplete="email" />
                {err("email")}
              </label>
              {password}
            </>
          )}
          {mode === "forgot" && (
            <label htmlFor="acc-email">
              Email
              <input {...field("email")} type="email" placeholder="you@example.com" autoComplete="email" />
              {err("email")}
            </label>
          )}
          <button type="submit" className="btn block lg">
            {mode === "in" ? "Login" : mode === "up" ? "Create account" : "Send reset link"} <ArrowRight size={16} />
          </button>
        </form>
      )}

      {mode === "forgot" ? (
        <button type="button" className="acc-back" onClick={() => switchTo("in")}>
          <ArrowLeft size={16} /> Back to login
        </button>
      ) : (
        <>
          <div className="acc-divider">
            <span>or</span>
          </div>

          <a
            className="btn wa-outline block"
            href={waLink(site.whatsappNumber, "Hi Zelvomart! I'd like help with my order.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon size={17} /> Get order help on WhatsApp
          </a>

          <div className="acc-guest">
            <ShieldCheck size={18} />
            <p>
              <strong>No account? No problem.</strong> Guest checkout with Cash on Delivery takes under a minute.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const actions = [
  { icon: PackageSearch, title: "Track an order", sub: "Live status of your parcel", href: "/track-your-order/" },
  { icon: Heart, title: "Wishlist", sub: "Items you've saved", href: "/wishlist/", count: "wishlist" as const },
  { icon: ShoppingCart, title: "My cart", sub: "Ready when you are", href: "/cart/", count: "cart" as const },
  { icon: RefreshCw, title: "Returns", sub: `${site.returns.windowDays}-day return window`, href: "/refund-and-return-policy/" },
  { icon: MapPin, title: "Delivery info", sub: "Areas, fees & timing", href: "/shipping-policy/" },
  { icon: Headset, title: "Support", sub: "Talk to our team", href: "/contact-us/" },
];

export function AccountDashboard() {
  const { orders, wishlist, cartCount, ready } = useShop();
  const counts = { wishlist: wishlist.length, cart: cartCount };

  return (
    <div className="acc-dash">
      <div className="acc-panel">
        <div className="acc-panel-head">
          <div>
            <div className="eyebrow">Quick actions</div>
            <h2>Everything you need.</h2>
          </div>
        </div>
        <div className="acc-actions">
          {actions.map((a) => (
            <Link href={a.href} className="acc-action" key={a.title}>
              <span className="acc-action-ico">
                <a.icon size={20} />
              </span>
              <span className="acc-action-text">
                <strong>{a.title}</strong>
                <small>{a.sub}</small>
              </span>
              {a.count && ready && counts[a.count] > 0 ? (
                <span className="acc-badge">{counts[a.count]}</span>
              ) : (
                <ArrowUpRight size={15} className="acc-action-arrow" />
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="acc-panel" id="acc-orders">
        <div className="acc-panel-head">
          <div>
            <div className="eyebrow">Order history</div>
            <h2>Recent orders.</h2>
          </div>
          {ready && orders.length > 0 && <span className="acc-count-pill">{orders.length} on this device</span>}
        </div>

        {!ready ? (
          <div className="acc-orders-skeleton" />
        ) : orders.length ? (
          <ul className="acc-orders">
            {orders.slice(0, 5).map((o) => {
              const items = o.lines.reduce((s, l) => s + l.qty, 0);
              return (
                <li key={o.id}>
                  <span className="acc-order-ico">
                    <Package size={19} />
                  </span>
                  <span className="acc-order-main">
                    <strong>{o.id}</strong>
                    <small>
                      {new Date(o.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })} · {items}{" "}
                      {items === 1 ? "item" : "items"} · {o.customer.city}
                    </small>
                  </span>
                  <span className="acc-status">Confirmed · COD</span>
                  <span className="acc-order-right">
                    <b>{money(o.total)}</b>
                    <Link href={`/order-confirmed/?id=${o.id}`}>
                      View <ArrowRight size={13} />
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="acc-empty">
            <span className="acc-empty-ico">
              <ShoppingBag size={26} />
            </span>
            <h3>No orders yet</h3>
            <p>When you place an order on this device, it&apos;ll show up here with its details and total.</p>
            <Link href="/shop-all-products/" className="btn">
              Start shopping <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
