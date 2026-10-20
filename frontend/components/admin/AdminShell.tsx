"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminNav from "./AdminNav";
import AdminNotifications from "./AdminNotifications";
import { clientApi, logoutAdminSession } from "@/lib/client-api";
import { clearAdminDataCache, prefetchAdminData } from "./useAdminData";



type User = { id: string; name: string; email: string; role: string };

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sectionName = pathname.split("/")[2]?.replace(/-/g, " ") || "Dashboard";
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);

      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []).filter(element => element.getClientRects().length > 0);
    const elements = focusable();
    elements?.[0]?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !elements?.length) return;
      const visible = focusable();
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", trapFocus);
      previousFocus?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    let active = true;
    setChecking(true);
    clientApi<{ user: User }>("/api/auth/me", {}, true)
      .then((r) => {
        if (!active) return;
        setUser(r.user);
        setChecking(false);
        if (r.user.role !== "MARKETER") prefetchAdminData("/api/admin/dashboard");
      })
      .catch(async () => {
        if (!active) return;
        clearAdminDataCache();
        await logoutAdminSession();
        router.replace("/admin/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (user?.role === "MARKETER" && pathname === "/admin") {
      // Reports now redirects to /admin; using it here creates a navigation loop.
      router.replace("/admin/products");
    }
  }, [user, pathname, router]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initials = useMemo(
    () =>
      (user?.name || user?.email || "A")
        .split(" ")
        .map((x) => x[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [user],
  );

  async function signOut() {
    clearAdminDataCache();
    await logoutAdminSession();
    router.replace("/admin/login");
    router.refresh();
  }

  if (checking || !user) {
    return (
      <div className="admin-auth-check">
        <div className="admin-auth-check-card">
          <Image
            src="/images/zelvomart-logo.png"
            alt="Zelvomart"
            width={357}
            height={235}
            className="admin-auth-logo-image"
            priority
          />
          <div>
            <b>Checking admin session…</b>
            <small>Please wait</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="admin-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside ref={sidebarRef} id="admin-navigation" aria-label="Admin navigation" className={`admin-sidebar${mobileOpen ? " mobile-open" : ""}`}>
        {/* Brand Header */}
        <div className="admin-sidebar-header">
          <Link href="/admin" className="admin-sidebar-brand" aria-label="Zelvomart admin home">
            <Image
              src="/images/zelvomart-logo.png"
              alt="Zelvomart"
              width={140}
              height={50}
              className="admin-brand-logo-image"

              priority
            />
            <span className="admin-brand-role-label"><strong>Administration</strong><small>{user.role.replace(/_/g, " ").toLowerCase()} workspace</small></span>


          </Link>
          <button type="button" className="admin-drawer-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>×</button>
        </div>

        {/* Navigation Groups */}
        <AdminNav role={user.role} onNavigate={() => setMobileOpen(false)} />

        <section className="admin-my-account" aria-labelledby="admin-my-account-label">
          <h2 id="admin-my-account-label">My account</h2>
          <div className="admin-my-account-profile"><span className="admin-my-account-avatar">{initials}</span><div><strong title={user.name || "Admin"}>{user.name || "Admin"}</strong><small className="admin-my-account-email" title={user.email}>{user.email}</small></div></div>
          <button type="button" className="admin-account-link admin-account-logout" onClick={signOut}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H4v18h5M10 12h11m-5-5 5 5-5 5" /></svg><span>Log out</span></button>
        </section>
      </aside>

      {/* Main Workspace */}
      <div className="admin-workspace">
        {/* Topbar matching reference image */}
        <header className="admin-topbar">
          {/* Mobile hamburger toggle */}
          <button
            type="button"
            className="admin-mobile-toggle"
            aria-label="Open navigation menu" aria-expanded={mobileOpen} aria-controls="admin-navigation"
            onClick={() => setMobileOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="admin-topbar-context"><span>Workspace</span><span aria-hidden="true">/</span><strong>{sectionName}</strong></div>
          {/* Topbar Search Pill */}
          <form className="admin-topbar-search" action="/admin/products" role="search">
            <span className="admin-topbar-search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={searchRef}
              type="text"
              className="admin-topbar-search-input"
              placeholder="Search products, categories, SKU..."
              name="q" aria-label="Search products, categories, or SKU"
            />
            <kbd className="admin-search-shortcut" aria-hidden="true">⌘/Ctrl K</kbd>
          </form>
          <AdminNotifications role={user.role} />
          <Link href="/" target="_blank" rel="noopener noreferrer" className="admin-topbar-store" aria-label="View storefront (opens in a new tab)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 10v10h16V10M3 10l2-7h14l2 7ZM9 20v-6h6v6" /></svg><span>View storefront</span><span aria-hidden="true">↗</span></Link>
        </header>

        {/* Content area */}
        <main className="admin-main">{children}</main>
        <footer className="admin-workspace-footer">
          <span>© {new Date().getUTCFullYear()} <strong>Zelvomart.</strong> All rights reserved.</span>
          <Link href="/contact-us" target="_blank" rel="noopener noreferrer" className="admin-footer-support">Help &amp; support <span aria-hidden="true">→</span></Link>
        </footer>

      </div>
    </div>
  );
}
