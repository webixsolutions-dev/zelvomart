"use client";
import AdminTable from '@/components/admin/AdminTable';


import Link from "next/link";
import { money } from "@/lib/format";
import { useAdminData, AdminError } from "@/components/admin/useAdminData";
import { DashboardIcon, MetricCard } from "@/components/admin/DashboardMetrics";
import DashboardInsights from "@/components/admin/DashboardInsights";

type Order = { id: string; orderNumber: string; createdAt: string; fullName: string; city: string; status: string; total: number };
type DashboardData = {
  ordersToday: number; ordersYesterday: number; revenueToday: number; revenueYesterday: number;
  delivered: number; failedJobs: number; customers: number; products: number;
  acceptedPurchases: number; trackingCoverage: number; teamEmails: number; emailCoverage: number;
  events: Record<string, number>; recent: Order[];
};

export default function Dashboard() {
  const { data, error, loading, reload } = useAdminData<DashboardData | null>("/api/admin/dashboard", null);
  const events = data?.events || {};
  return (
    <div className="dashboard-overview" aria-busy={loading}>
      <div className="dashboard-heading">
        <div><span className="dashboard-eyebrow">OVERVIEW</span><h1>Dashboard</h1><p>Everything you need to manage today&apos;s Zelvomart operations.</p></div>
        <div className="dashboard-actions">
          <Link href="/admin/products" className="dashboard-button"><DashboardIcon name="box" />Manage products</Link>
          <Link href="/admin/orders" className="dashboard-button primary"><DashboardIcon name="arrow" />View all orders</Link>
        </div>
      </div>
      {error ? <div role="alert"><AdminError message={error} /><button className="dashboard-button" onClick={() => void reload()}>Try again</button></div> : <>
        <div className="dashboard-metrics">
          <MetricCard label="Orders today" value={data?.ordersToday} icon="cart" color="blue" detail={data ? `${data.ordersYesterday} yesterday` : undefined} />
          <MetricCard label="Revenue today" value={data ? money(data.revenueToday) : undefined} icon="revenue" color="green" detail={data ? `${money(data.revenueYesterday)} yesterday` : undefined} />
          <MetricCard label="Delivered" value={data?.delivered} icon="truck" color="purple" detail="Completed today" />
          <MetricCard label="Failed jobs" value={data?.failedJobs} icon="briefcase" color="orange" detail="Needs attention" />
          <MetricCard label="Customers" value={data?.customers} icon="user" color="blue" href="/admin/customers" detail="View records" />
          <MetricCard label="Live products" value={data?.products} icon="box" color="purple" href="/admin/products" detail="Manage catalog" />
          <MetricCard label="Product views" value={data ? events.ViewContent || 0 : undefined} icon="eye" color="teal" href="/admin/tracking" detail="Tracking health" />
          <MetricCard label="Purchases" value={data ? events.Purchase || 0 : undefined} icon="cart" color="pink" href="/admin/orders" detail="View orders" />
        </div>
        <DashboardInsights data={data} />
        <section className="dashboard-orders" aria-labelledby="recent-orders-heading">
          <div className="dashboard-orders-heading"><div><h2 id="recent-orders-heading">Recent orders</h2><p>Latest orders from the backend database.</p></div><Link href="/admin/orders">View all orders <span aria-hidden="true">→</span></Link></div>
          <div className="dashboard-table-scroll"><AdminTable scrollLabel="Recent orders" className="dashboard-table"><thead><tr>{["Order", "Date", "Customer", "City", "Status", "Total"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{!data ? <tr><td colSpan={6}><div className="dashboard-empty" role="status">Loading recent orders…</div></td></tr> : data.recent?.length ? data.recent.map(order => <tr key={order.id}>
              <td><Link className="admin-order-link" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td><td>{new Date(order.createdAt).toLocaleString("en-PK")}</td><td>{order.fullName}</td><td>{order.city}</td><td><span className="dashboard-status">{String(order.status).replace(/_/g, " ")}</span></td><td>{money(order.total)}</td>
            </tr>) : <tr><td colSpan={6}><div className="dashboard-empty"><DashboardIcon name="document" /><strong>No recent orders</strong><p>Orders will appear here once customers start placing them.</p></div></td></tr>}</tbody>
          </AdminTable></div>
        </section>
      </>}
    </div>
  );
}
