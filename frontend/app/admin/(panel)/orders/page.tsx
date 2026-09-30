import Link from "next/link";
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { can } from "@/lib/permissions";
import { money } from "@/lib/format";

function v(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input || ""; }

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin("orders.read");
  const sp = await searchParams;
  const status = v(sp.status);
  const city = v(sp.city);
  const source = v(sp.source);
  const from = v(sp.from);
  const to = v(sp.to);

  const where: Prisma.OrderWhereInput = {
    ...(status && Object.values(OrderStatus).includes(status as OrderStatus) ? { status: status as OrderStatus } : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    ...(source ? { source: { contains: source, mode: "insensitive" } } : {}),
    ...((from || to) ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00+05:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59+05:00`) } : {}) } } : {}),
  };

  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });

  return (
    <>
      <div className="admin-title">
        <div><h1>Orders</h1><p>Filter, review, print and manage COD orders.</p></div>
        {can(user.role, "orders.export") ? <a className="admin-btn admin-btn-light" href="/api/admin/orders/export">Export CSV</a> : null}
      </div>

      <form className="admin-filter-bar">
        <select name="status" defaultValue={status}><option value="">All statuses</option>{Object.values(OrderStatus).map((value) => <option key={value}>{value}</option>)}</select>
        <input name="city" defaultValue={city} placeholder="City" />
        <input name="source" defaultValue={source} placeholder="Source" />
        <input type="date" name="from" defaultValue={from} />
        <input type="date" name="to" defaultValue={to} />
        <button className="admin-btn admin-btn-primary">Filter</button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Phone</th><th>City</th><th>Status</th><th>Total</th><th>Flags</th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td><Link className="admin-order-link" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td>
                <td>{order.createdAt.toLocaleString("en-PK")}</td>
                <td>{order.fullName}</td>
                <td>{order.phone}</td>
                <td>{order.city}</td>
                <td><span className="status-pill">{order.status.replace(/_/g, " ")}</span></td>
                <td>{money(order.total)}</td>
                <td>{order.possibleDuplicate ? "Duplicate " : ""}{order.blocklistedAtOrder ? "Blocked" : ""}</td>
              </tr>
            ))}
            {!orders.length ? <tr><td colSpan={8} className="admin-empty">No orders match the selected filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
