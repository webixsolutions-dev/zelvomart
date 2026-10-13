"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefetchAdminData } from "./useAdminData";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-nav-svg">
      {children}
    </svg>
  );
}

const icons = {
  dashboard: <Icon><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></Icon>,
  orders: <Icon><path d="M6 3h12l2 4v14H4V7l2-4Z"/><path d="M4 8h16M9 12h6"/></Icon>,
  products: <Icon><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></Icon>,
  categories: <Icon><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></Icon>,
  pages: <Icon><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></Icon>,
  customers: <Icon><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6M16 5.5a3 3 0 0 1 0 5.8M16.5 14c2.4.3 3.7 2.2 4 5"/></Icon>,
  settings: <Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Icon>,
  users: <Icon><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6M17 10v6M14 13h6"/></Icon>,
  reports: <Icon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Icon>,
  marketing: <Icon><path d="M4 18V8l8-4 8 4v10l-8 3-8-3Z"/><path d="M8 11h8M8 15h5"/></Icon>,
  cro: <Icon><path d="M4 19V5M4 19h16M7 15l4-4 3 2 5-7"/><path d="M16 6h3v3"/></Icon>,
  replays: <Icon><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/></Icon>,
  tracking: <Icon><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></Icon>,
  jobs: <Icon><path d="M4 7h16v12H4zM8 7V4h8v3M8 12h8M8 16h5"/></Icon>,
  abandoned: <Icon><path d="M5 5h14v14H5zM8 9h8M8 13h5"/><path d="m15 15 3 3"/></Icon>,
  experiments: <Icon><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4h8.8A3 3 0 0 0 19 17l-5-9V3M8 15h8"/></Icon>,
  reviews: <Icon><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9L12 3Z"/></Icon>,
  redirects: <Icon><path d="M4 7h10a5 5 0 0 1 5 5v1M16 10l3 3 3-3M20 17H10a5 5 0 0 1-5-5v-1M8 14l-3-3-3 3"/></Icon>,
};

const adminApiByHref: Record<string, string> = {
  "/admin": "/api/admin/dashboard",
  "/admin/products": "/api/admin/products",
  "/admin/products/drafts": "/api/admin/products",
  "/admin/products/add": "/api/admin/categories",
  "/admin/tags": "/api/admin/products",
  "/admin/discounts": "/api/admin/products",
  "/admin/product-tabs": "/api/admin/product-tabs",
  "/admin/orders": "/api/admin/orders",
  "/admin/categories": "/api/admin/categories",
  "/admin/customers": "/api/admin/customers",
  "/admin/settings": "/api/admin/settings",
  "/admin/users": "/api/admin/users",
  "/admin/reports": "/api/admin/reports",
  "/admin/marketing": "/api/admin/marketing",
  "/admin/cro": "/api/admin/cro",
  "/admin/session-replays": "/api/admin/session-replays",
  "/admin/tracking": "/api/admin/tracking",
  "/admin/jobs": "/api/admin/jobs",
  "/admin/abandoned": "/api/admin/abandoned",
  "/admin/experiments": "/api/admin/experiments",
  "/admin/reviews": "/api/admin/reviews",
  "/admin/redirects": "/api/admin/redirects",
};

type NavLink = readonly [string, string, ReactNode];

const productLinks: NavLink[] = [
  ["/admin/products", "All products", icons.products],
  ["/admin/products/drafts", "Drafts", icons.products],
  ["/admin/products/add", "Add product", icons.products],
  ["/admin/categories", "Categories", icons.categories],
  ["/admin/tags", "Tags", icons.products],
  ["/admin/discounts", "Discounts", icons.products],
  ["/admin/reviews", "Reviews", icons.reviews],
  ["/admin/product-tabs", "Product tabs", icons.pages],
];

const groups = [
  {
    label: "Store",
    links: [
      ["/admin", "Dashboard", icons.dashboard],
      ["/admin/orders", "Orders", icons.orders],
      ["/admin/customers", "Customers", icons.customers],
    ] as NavLink[],
  },
  {
    label: "Management",
    links: [
      ["/admin/settings", "Settings", icons.settings],
      ["/admin/users", "Users & Roles", icons.users],
      ["/admin/reports", "Reports", icons.reports],
      ["/admin/marketing", "Meta & Attribution", icons.marketing],
      ["/admin/cro", "CRO", icons.cro],
      ["/admin/session-replays", "Session Replays", icons.replays],
    ] as NavLink[],
  },
  {
    label: "Operations",
    links: [
      ["/admin/tracking", "Tracking Health", icons.tracking],
      ["/admin/jobs", "Background Jobs", icons.jobs],
      ["/admin/abandoned", "Abandoned", icons.abandoned],
      ["/admin/experiments", "Experiments", icons.experiments],
      ["/admin/redirects", "SEO Redirects", icons.redirects],
    ] as NavLink[],
  },
];

function linkIsActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/products") {
    return pathname === href || /^\/admin\/products\/(?!add(?:\/|$)|drafts(?:\/|$))[^/]+$/.test(pathname);
  }
  if (href === "/admin/products/drafts") return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  pathname: string;
}) {
  const active = linkIsActive(pathname, href);
  return (
    <Link
      href={href}
      prefetch
      className={`admin-nav-link${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      onMouseEnter={() => adminApiByHref[href] && prefetchAdminData(adminApiByHref[href])}
      onFocus={() => adminApiByHref[href] && prefetchAdminData(adminApiByHref[href])}
    >
      <span className="admin-nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function AdminNav({ role = "OWNER" }: { role?: string }) {
  const pathname = usePathname();
  const allowed = (href: string) => {
    if (role === "OWNER") return true;
    if (role === "ORDER_AGENT") return ["/admin", "/admin/orders", "/admin/customers"].includes(href);
    if (role === "MANAGER") return !["/admin/settings", "/admin/users", "/admin/redirects"].includes(href);
    if (role === "MARKETER") {
      return [
        "/admin/products",
        "/admin/products/drafts",
        "/admin/products/add",
        "/admin/categories",
        "/admin/tags",
        "/admin/discounts",
        "/admin/product-tabs",
        "/admin/reports",
        "/admin/marketing",
        "/admin/cro",
        "/admin/session-replays",
        "/admin/tracking",
        "/admin/jobs",
        "/admin/experiments",
        "/admin/reviews",
      ].includes(href);
    }
    return false;
  };

  const visibleProductLinks = productLinks.filter(([href]) => allowed(href));
  const productsActive = visibleProductLinks.some(([href]) => linkIsActive(pathname, href));
  const [productsOpen, setProductsOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ left: 240, top: 0, height: "100vh" });
  const productsRef = useRef<HTMLDivElement>(null);

  function placeProductsPanel() {
    const sidebar = productsRef.current?.closest(".admin-sidebar") as HTMLElement | null;
    const button = productsRef.current?.querySelector(".admin-nav-parent") as HTMLElement | null;
    if (!sidebar || !button) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const mobile = window.innerWidth <= 980;
    if (mobile) {
      setPanelPos({
        left: Math.max(8, buttonRect.left),
        top: buttonRect.bottom + 8,
        height: "auto",
      });
      return;
    }
    setPanelPos({
      left: sidebarRect.right,
      top: buttonRect.top + buttonRect.height / 2,
      height: "auto",
    });
  }

  useEffect(() => {
    setProductsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!productsOpen) return;
    placeProductsPanel();
    const onReposition = () => placeProductsPanel();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProductsOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".admin-nav-flyout-group") && !target?.closest(".admin-nav-flyout-panel")) {
        setProductsOpen(false);
      }
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [productsOpen]);

  return (
    <nav className="admin-nav" aria-label="Admin sidebar">
      {groups[0] ? (
        <div className="admin-nav-group" key={groups[0].label}>
          <div className="admin-nav-label">{groups[0].label}</div>
          {groups[0].links.filter(([href]) => allowed(href)).map(([href, label, icon]) => (
            <NavItem key={href} href={href} label={label} icon={icon} pathname={pathname} />
          ))}
        </div>
      ) : null}

      {visibleProductLinks.length ? (
        <div className="admin-nav-group admin-nav-flyout-group" ref={productsRef}>
          <div className="admin-nav-label">Catalog</div>
          <button
            type="button"
            className={`admin-nav-link admin-nav-parent${productsOpen ? " is-open" : ""}${productsActive ? " is-current" : ""}`}
            aria-expanded={productsOpen}
            aria-controls="admin-products-submenu"
            onClick={() => setProductsOpen((open) => !open)}
          >
            <span className="admin-nav-icon">{icons.products}</span>
            <span>Products</span>
            <em className="admin-nav-caret" aria-hidden="true" />
          </button>
          <div
            className={`admin-nav-flyout-panel${productsOpen ? " is-open" : ""}`}
            id="admin-products-submenu"
            style={{ left: panelPos.left, top: panelPos.top, height: panelPos.height }}
          >
            <div className="admin-nav-flyout-panel-inner">
              {visibleProductLinks.map(([href, label]) => {
                const active = linkIsActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch
                    className={`admin-nav-flyout-link${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={() => adminApiByHref[href] && prefetchAdminData(adminApiByHref[href])}
                    onFocus={() => adminApiByHref[href] && prefetchAdminData(adminApiByHref[href])}
                    onClick={() => setProductsOpen(false)}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {groups.slice(1).map((group) => (
        <div className="admin-nav-group" key={group.label}>
          <div className="admin-nav-label">{group.label}</div>
          {group.links.filter(([href]) => allowed(href)).map(([href, label, icon]) => (
            <NavItem key={href} href={href} label={label} icon={icon} pathname={pathname} />
          ))}
        </div>
      ))}
    </nav>
  );
}
