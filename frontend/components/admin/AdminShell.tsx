"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminNav from "./AdminNav";
import { clientApi, logoutAdminSession } from "@/lib/client-api";
import { clearAdminDataCache, prefetchAdminData } from "./useAdminData";

type User = { id: string; name: string; email: string; role: string };

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const topbarMenuRef = useRef<HTMLDivElement>(null);

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
      router.replace("/admin/reports");
    }
  }, [user, pathname, router]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (topbarMenuRef.current && !topbarMenuRef.current.contains(event.target as Node)) {
        setTopbarMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      <aside className={`admin-sidebar${mobileOpen ? " mobile-open" : ""}`}>
        {/* Brand Header with collapse button */}
        <div className="admin-sidebar-header">
          <button
            type="button"
            className="admin-sidebar-collapse-btn"
            aria-label="Collapse sidebar"
            onClick={() => setMobileOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <Link href="/admin" className="admin-sidebar-brand" aria-label="Zelvomart admin home">
            <Image
              src="/images/zelvomart-logo.png"
              alt="Zelvomart"
              width={112}
              height={74}
              className="admin-brand-logo-image"
              style={{ objectFit: "contain", height: "36px", width: "auto" }}
              priority
            />
            <span className="admin-brand-portal-label" style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.08em" }}>
              ADMIN PORTAL
            </span>
          </Link>
        </div>

        {/* Navigation Groups */}
        <AdminNav role={user.role} onNavigate={() => setMobileOpen(false)} />

        {/* Bottom Profile Card */}
        <div className="admin-sidebar-foot">
          <div className="admin-profile-card" ref={userMenuRef}>
            <div className="admin-profile-card-left">
              <span className="admin-profile-avatar">{initials}</span>
              <div className="admin-profile-info">
                <strong className="admin-profile-name">{user.name || "Admin"}</strong>
                <span className="admin-profile-role">
                  {String(user.role || "").replace(/_/g, " ").toLowerCase() === "owner"
                    ? "Admin"
                    : String(user.role || "").replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="admin-profile-action-btn"
              aria-label="User settings"
              onClick={() => setUserMenuOpen((prev) => !prev)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="admin-user-menu" role="menu">
                <Link
                  href="/"
                  target="_blank"
                  className="admin-user-menu-item"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  <span>View Storefront</span>
                </Link>
                <Link
                  href="/admin/settings"
                  className="admin-user-menu-item"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                  </svg>
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  className="admin-user-menu-item danger"
                  role="menuitem"
                  onClick={signOut}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="admin-workspace">
        {/* Topbar matching reference image */}
        <header className="admin-topbar">
          {/* Mobile hamburger toggle */}
          <button
            type="button"
            className="admin-mobile-toggle"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Topbar Search Pill */}
          <div className="admin-topbar-search">
            <span className="admin-topbar-search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              className="admin-topbar-search-input"
              placeholder="Search products, categories, SKU..."
              aria-label="Search dashboard"
            />
          </div>

          {/* Topbar Right Actions */}
          <div className="admin-topbar-right">
            {/* Notification bell with count badge */}
            <button type="button" className="admin-icon-btn" aria-label="Notifications (3 unread)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="admin-badge-count">3</span>
            </button>

            {/* Theme / sun toggle */}
            <button type="button" className="admin-icon-btn" aria-label="Toggle theme">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </button>

            {/* User pill with dropdown */}
            <div className="relative" ref={topbarMenuRef}>
              <div
                className="admin-topbar-user"
                role="button"
                tabIndex={0}
                aria-expanded={topbarMenuOpen}
                onClick={() => setTopbarMenuOpen((prev) => !prev)}
                onKeyDown={(e) => e.key === "Enter" && setTopbarMenuOpen((prev) => !prev)}
              >
                <span className="admin-topbar-user-avatar">{initials}</span>
                <span className="admin-topbar-user-name">Admin</span>
                <span className="admin-topbar-user-chevron">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>

              {topbarMenuOpen && (
                <div className="admin-user-menu" style={{ top: "calc(100% + 8px)", bottom: "auto" }} role="menu">
                  <div style={{ padding: "6px 10px", borderBottom: "1px solid #edf2f7", marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0b1a2e" }}>{user.name || "Admin"}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{user.email}</div>
                  </div>
                  <Link
                    href="/"
                    target="_blank"
                    className="admin-user-menu-item"
                    role="menuitem"
                    onClick={() => setTopbarMenuOpen(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    <span>View Storefront</span>
                  </Link>
                  <Link
                    href="/admin/settings"
                    className="admin-user-menu-item"
                    role="menuitem"
                    onClick={() => setTopbarMenuOpen(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                    </svg>
                    <span>Settings</span>
                  </Link>
                  <button
                    type="button"
                    className="admin-user-menu-item danger"
                    role="menuitem"
                    onClick={signOut}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
