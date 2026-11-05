"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import "@/components/admin/catalog-pages.css";
import "./payments.css";
import AdminTable from "@/components/admin/AdminTable";
import {
  EmptyState,
  ErrorBanner,
  StatusBadge,
} from "@/components/admin/AdminListView";
import { AdminLoading } from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";
import { money } from "@/lib/format";
import { FlagChips, PROOF_STATUS } from "@/components/admin/PaymentBits";

type Row = {
  id: string;
  status: string;
  method: string;
  tid: string;
  amountSent: number;
  senderName: string;
  createdAt: string;
  flags: string[];
  order: {
    id: string;
    orderNumber: string;
    fullName: string;
    total: number;
    status: string;
    paymentStatus: string;
  };
};
type ListResponse = {
  rows: Row[];
  total: number;
  counts: Record<string, number>;
};

const VIEWS = [
  ["needs", "Needs verification"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
  ["all", "All"],
] as const;
const when = (s: string) =>
  new Date(s).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });

export default function Payments() {
  const [view, setView] = useState<(typeof VIEWS)[number][0]>("needs");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      setData(
        await clientApi<ListResponse>(
          `/api/admin/payments?view=${view}&q=${encodeURIComponent(search)}`,
          {},
          true,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payments");
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search]);

  return (
    <div className="admin-catalog-page pay-admin">
      <div className="admin-title">
        <div>
          <h1>Payments</h1>
          <p>
            Advance payments by Easypaisa Till / Raast QR. Check every proof in
            the Easypaisa merchant app before you verify: a screenshot is never
            proof on its own.
          </p>
        </div>
      </div>
      <div className="pay-tabs" role="group" aria-label="Show">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label}
            {data?.counts?.[key] !== undefined && <b>{data.counts[key]}</b>}
          </button>
        ))}
      </div>
      <form
        className="pay-search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Order number, TID or sender"
          aria-label="Search payments"
        />
        <button className="admin-btn admin-btn-light">Search</button>
      </form>
      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : !data ? (
        <AdminLoading />
      ) : !data.rows.length ? (
        <EmptyState
          title={view === "needs" ? "Nothing to verify" : "No payments here"}
          message="New proofs appear here as customers send them."
        />
      ) : (
        <AdminTable aria-label="Payment proofs" tableId="admin-payments">
          <thead>
            <tr>
              <th>Order</th>
              <th>Sent</th>
              <th>Order total</th>
              <th>TID / sender</th>
              <th>Flags</th>
              <th>Status</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link
                    className="pay-row-link"
                    href={`/admin/payments/${row.id}`}
                  >
                    {row.order.orderNumber}
                  </Link>
                  <br />
                  <small>{row.order.fullName}</small>
                </td>
                <td
                  className={
                    row.flags.includes("AMOUNT") ? "pay-flag-text" : ""
                  }
                >
                  {money(row.amountSent)}
                </td>
                <td>{money(row.order.total)}</td>
                <td>
                  <code>{row.tid}</code>
                  <br />
                  <small>{row.senderName}</small>
                </td>
                <td>
                  <FlagChips flags={row.flags} />
                </td>
                <td>
                  <StatusBadge
                    value={row.status}
                    label={PROOF_STATUS[row.status]?.label}
                    tone={PROOF_STATUS[row.status]?.tone}
                  />
                </td>
                <td>
                  <small>{when(row.createdAt)}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
    </div>
  );
}
