"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { prefetchAdminData } from "./useAdminData";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-nav-svg">
      {children}
    </svg>
  );
}

const icons = {
  dashboard: (
    <Icon>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Icon>
  ),
  orders: (
    <Icon>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Icon>
  ),
  products: (
    <Icon>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </Icon>
  ),
  categories: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  tags: (
    <Icon>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </Icon>
  ),
  discounts: (
    <Icon>
      <circle cx="9" cy="9" r="2" />
      <circle cx="15" cy="15" r="2" />
      <line x1="16" y1="8" x2="8" y2="16" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </Icon>
  ),
  pages: (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Icon>
  ),
  customers: (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Icon>
  ),
  users: (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  reports: (
    <Icon>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Icon>
  ),
  marketing: (
    <Icon>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  ),
  cro: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  ),
  replays: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </Icon>
  ),
  tracking: (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  ),
  jobs: (
    <Icon>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </Icon>
  ),
  abandoned: (
    <Icon>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </Icon>
  ),
  experiments: (
    <Icon>
      <path d="M10 2v7.31L4.69 19A2 2 0 0 0 6.42 22h11.16a2 2 0 0 0 1.73-3L14 9.31V2" />
      <line x1="8" y1="2" x2="16" y2="2" />
      <line x1="8.5" y1="14" x2="15.5" y2="14" />
    </Icon>
  ),
  reviews: (
    <Icon>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  ),
  redirects: (
    <Icon>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </Icon>
  ),
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
    label: "Catalog",
    links: [
      ["/admin/products", "Products", icons.products],
      ["/admin/categories", "Categories", icons.categories],
      ["/admin/tags", "Tags", icons.tags],
      ["/admin/discounts", "Discounts", icons.discounts],
      ["/admin/reviews", "Reviews", icons.reviews],
      ["/admin/product-tabs", "Product tabs", icons.pages],
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
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  pathname: string;
  onNavigate?: () => void;
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
      onClick={() => onNavigate?.()}
    >
      <span className="admin-nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function AdminNav({
  role = "OWNER",
  onNavigate,
}: {
  role?: string;
  onNavigate?: () => void;
}) {
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

  return (
    <nav className="admin-nav" aria-label="Admin sidebar">
      {groups.map((group) => {
        const visibleLinks = group.links.filter(([href]) => allowed(href));
        if (!visibleLinks.length) return null;

        return (
          <div className="admin-nav-group" key={group.label}>
            <div className="admin-nav-label">{group.label}</div>
            {visibleLinks.map(([href, label, icon]) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
