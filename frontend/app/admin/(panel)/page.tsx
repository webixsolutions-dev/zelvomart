import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { money } from "@/lib/format";

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function pct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function AdminDashboard() {
  await requireAdmin();
  const today = startOfDay();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const [
    todayOrders,
    yesterdayOrders,
    failedJobs,
    purchases,
    acceptedPurchases,
    recent,
    newOrders,
    deliveredToday,
    customerCount,
    productCount,
    lowStock,
    funnelEvents,
  ] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: today }, test: false }, select: { total: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: yesterday, lt: today }, test: false }, select: { total: true } }),
    prisma.job.count({ where: { status: "FAILED" } }),
    prisma.order.count({ where: { createdAt: { gte: today }, test: false, staffCreated: false } }),
    prisma.eventLog.count({ where: { eventName: "Purchase", channel: "server", accepted: true, createdAt: { gte: today } } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.order.count({ where: { status: "NEW", test: false } }),
    prisma.order.count({ where: { status: "DELIVERED", updatedAt: { gte: today }, test: false } }),
    prisma.customer.count(),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.product.count({ where: { status: "PUBLISHED", stock: { lte: 5 } } }),
    prisma.eventLog.groupBy({ by: ["eventName"], where: { createdAt: { gte: today }, channel: "browser" }, _count: { _all: true } }),
  ]);

  const todayRevenue = todayOrders.reduce((sum, row) => sum + Number(row.total), 0);
  const yesterdayRevenue = yesterdayOrders.reduce((sum, row) => sum + Number(row.total), 0);
  const orderChange = pct(todayOrders.length, yesterdayOrders.length);
  const revenueChange = pct(todayRevenue, yesterdayRevenue);
  const trackingOk = purchases === acceptedPurchases;
  const funnel = new Map(funnelEvents.map((row) => [row.eventName, row._count._all]));

  const statusClass = (status: string) => `status-pill status-${status.toLowerCase().replace(/_/g, "-")}`;

  return (
    <>
      <section className="admin-page-head">
        <div>
          <span className="admin-eyebrow">OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>Everything you need to manage today&apos;s Zelvomart operations.</p>
        </div>
        <div className="admin-head-actions">
          <Link href="/admin/products" className="admin-btn admin-btn-light">Manage products</Link>
          <Link href="/admin/orders" className="admin-btn admin-btn-primary">View all orders</Link>
        </div>
      </section>

      <section className="admin-kpis admin-kpis-modern">
        <div className="admin-stat-card">
          <div className="admin-stat-top"><span className="admin-stat-icon admin-stat-blue">▣</span><span className={`admin-trend ${orderChange >= 0 ? "up" : "down"}`}>{orderChange >= 0 ? "+" : ""}{orderChange}%</span></div>
          <small>Orders today</small><strong>{todayOrders.length}</strong><p>{newOrders} waiting for confirmation</p>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-top"><span className="admin-stat-icon admin-stat-green">₨</span><span className={`admin-trend ${revenueChange >= 0 ? "up" : "down"}`}>{revenueChange >= 0 ? "+" : ""}{revenueChange}%</span></div>
          <small>Revenue today</small><strong>{money(todayRevenue)}</strong><p>{money(yesterdayRevenue)} yesterday</p>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-top"><span className="admin-stat-icon admin-stat-violet">✓</span><span className="admin-stat-chip">Today</span></div>
          <small>Delivered</small><strong>{deliveredToday}</strong><p>Successfully completed orders</p>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-top"><span className="admin-stat-icon admin-stat-orange">!</span><span className={`admin-stat-chip ${failedJobs ? "danger" : ""}`}>{failedJobs ? "Needs attention" : "Healthy"}</span></div>
          <small>Failed jobs</small><strong>{failedJobs}</strong><p>{lowStock} low-stock products</p>
        </div>
      </section>

      <section className="admin-mini-grid">
        <Link href="/admin/customers" className="admin-mini-card"><span>Customers</span><b>{customerCount}</b><small>View customer records →</small></Link>
        <Link href="/admin/products" className="admin-mini-card"><span>Live products</span><b>{productCount}</b><small>Manage catalog →</small></Link>
        <Link href="/admin/orders" className="admin-mini-card"><span>New orders</span><b>{newOrders}</b><small>Start processing →</small></Link>
        <Link href="/admin/tracking" className="admin-mini-card"><span>Meta tracking</span><b>{acceptedPurchases}/{purchases}</b><small>{trackingOk ? "All accepted" : "Review tracking health"} →</small></Link>
      </section>

      <section className={`admin-health-card ${trackingOk ? "ok" : "warn"}`}>
        <div className="admin-health-icon">{trackingOk ? "✓" : "!"}</div>
        <div><b>{trackingOk ? "Tracking is healthy" : "Tracking needs attention"}</b><p>{acceptedPurchases} of {purchases} server Purchase events were accepted today.</p></div>
        <Link href="/admin/tracking">Open tracking health →</Link>
      </section>

      <section className="admin-section-card">
        <div className="admin-section-head"><div><span className="admin-eyebrow">TODAY&apos;S FUNNEL</span><h2>Storefront funnel</h2></div><Link href="/admin/reports">Open reports →</Link></div>
        <div className="admin-mini-grid">
          <div className="admin-mini-card"><span>Page views</span><b>{funnel.get("PageView") || 0}</b><small>Storefront visits</small></div>
          <div className="admin-mini-card"><span>Product views</span><b>{funnel.get("ViewContent") || 0}</b><small>Viewed a product</small></div>
          <div className="admin-mini-card"><span>Add to cart</span><b>{funnel.get("AddToCart") || 0}</b><small>Cart intent</small></div>
          <div className="admin-mini-card"><span>Checkout</span><b>{funnel.get("InitiateCheckout") || 0}</b><small>Checkout intent</small></div>
          <div className="admin-mini-card"><span>Orders</span><b>{todayOrders.length}</b><small>Saved orders</small></div>
        </div>
      </section>

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div><span className="admin-eyebrow">LATEST ACTIVITY</span><h2>Recent orders</h2></div>
          <Link href="/admin/orders">View all orders →</Link>
        </div>
        <div className="admin-table-wrap admin-table-modern">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Customer</th><th>City</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead>
            <tbody>
              {recent.length ? recent.map((order) => (
                <tr key={order.id}>
                  <td><Link className="admin-order-link" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td>
                  <td><b>{order.fullName}</b><small className="admin-cell-sub">{order.phone}</small></td>
                  <td>{order.city}</td>
                  <td><span className={statusClass(order.status)}>{order.status.replace(/_/g, " ")}</span></td>
                  <td><b>{money(order.total)}</b></td>
                  <td>{order.createdAt.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              )) : <tr><td colSpan={6} className="admin-empty">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
