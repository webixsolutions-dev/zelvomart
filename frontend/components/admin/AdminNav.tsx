"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
  customers: <Icon><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6M16 5.5a3 3 0 0 1 0 5.8M16.5 14c2.4.3 3.7 2.2 4 5"/></Icon>,
  settings: <Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Icon>,
  users: <Icon><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6M17 10v6M14 13h6"/></Icon>,
  reports: <Icon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Icon>,
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
  "/admin/orders": "/api/admin/orders",
  "/admin/categories": "/api/admin/categories",
  "/admin/customers": "/api/admin/customers",
  "/admin/settings": "/api/admin/settings",
  "/admin/users": "/api/admin/users",
  "/admin/reports": "/api/admin/reports",
  "/admin/tracking": "/api/admin/tracking",
  "/admin/jobs": "/api/admin/jobs",
  "/admin/abandoned": "/api/admin/abandoned",
  "/admin/experiments": "/api/admin/experiments",
  "/admin/reviews": "/api/admin/reviews",
  "/admin/redirects": "/api/admin/redirects",
};

const groups = [
  {
    label: "Store",
    links: [
      ["/admin", "Dashboard", icons.dashboard],
      ["/admin/products", "Products", icons.products],
      ["/admin/orders", "Orders", icons.orders],
      ["/admin/categories", "Categories", icons.categories],
      ["/admin/customers", "Customers", icons.customers],
    ],
  },
  {
    label: "Management",
    links: [
      ["/admin/settings", "Settings", icons.settings],
      ["/admin/users", "Users & Roles", icons.users],
      ["/admin/reports", "Reports", icons.reports],
    ],
  },
  {
    label: "Operations",
    links: [
      ["/admin/tracking", "Tracking Health", icons.tracking],
      ["/admin/jobs", "Background Jobs", icons.jobs],
      ["/admin/abandoned", "Abandoned", icons.abandoned],
      ["/admin/experiments", "Experiments", icons.experiments],
      ["/admin/reviews", "Reviews", icons.reviews],
      ["/admin/redirects", "SEO Redirects", icons.redirects],
    ],
  },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin sidebar">
      {groups.map((group) => (
        <div className="admin-nav-group" key={group.label}>
          <div className="admin-nav-label">{group.label}</div>
          {group.links.map(([href, label, icon]) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} prefetch className={`admin-nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} onMouseEnter={() => adminApiByHref[href] && prefetchAdminData(adminApiByHref[href])} onFocus={() => adminApiByHref[href] && prefetchAdminData(adminApiByHref[href])}>
                <span className="admin-nav-icon">{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
