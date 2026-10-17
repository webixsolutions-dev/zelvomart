"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAdminData } from "./useAdminData";

type Activity = { failedJobs: number; recent: { id: string; orderNumber: string; status: string }[] };

function ActivityFeed({ role }: { role: string }) {
  const { data, error, reload } = useAdminData<Activity | null>("/api/admin/dashboard", null);
  if (error) return <div className="admin-notification-empty" role="alert"><p>Could not load notifications.</p><button onClick={() => void reload()}>Try again</button></div>;
  if (!data) return <p className="admin-notification-empty" role="status">Loading activity…</p>;
  const canViewJobs = role === "OWNER" || role === "MANAGER";
  const hasFailures = canViewJobs && data.failedJobs > 0;
  return <>{hasFailures && <Link className="admin-notification-item warning" href="/admin/jobs"><strong>{data.failedJobs} failed background {data.failedJobs === 1 ? "job" : "jobs"}</strong><span>Review jobs that need attention →</span></Link>}{data.recent?.length ? <><h3 className="admin-notification-label">Recent orders</h3>{data.recent.slice(0, 5).map(order => <Link className="admin-notification-item" key={order.id} href={`/admin/orders/${order.id}`}><strong>{order.orderNumber}</strong><span>{String(order.status).replace(/_/g, " ")}</span></Link>)}<Link className="admin-notification-footer" href="/admin/orders">View all orders →</Link></> : <div className="admin-notification-empty"><strong>{hasFailures ? "No recent orders" : "You're all caught up"}</strong><p>No recent orders to display.</p></div>}</>;
}

export default function AdminNotifications({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="admin-notifications" ref={container} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={button} type="button" className="admin-icon-btn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded={open} aria-controls="admin-notifications-panel" onClick={() => setOpen(value => !value)}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M10 21h4" /></svg></button>
    {open && <div id="admin-notifications-panel" className="admin-notifications-panel" role="dialog" aria-labelledby="admin-notifications-title" tabIndex={-1}><div className="admin-notifications-heading"><div><h2 id="admin-notifications-title">Notifications</h2><p>Recent store activity</p></div><button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); button.current?.focus(); }}>×</button></div>{["OWNER", "MANAGER", "ORDER_AGENT"].includes(role) ? <ActivityFeed role={role} /> : <p className="admin-notification-empty">An activity feed is not available for your role.</p>}</div>}
  </div>;
}
