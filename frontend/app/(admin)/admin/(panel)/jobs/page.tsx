"use client";

import { useState } from "react";
import "@/components/admin/catalog-pages.css";
import AdminListView from "@/components/admin/AdminListView";
import AdminTable from "@/components/admin/AdminTable";
import {
  AdminError,
  AdminLoading,
  useAdminData,
} from "@/components/admin/useAdminData";
import { notifyError } from "@/lib/app-errors";
import { clientApi } from "@/lib/client-api";

type Job = {
  id: string;
  name: string;
  status: string;
  attempts: number;
  orderId?: string | null;
  error?: string | null;
  createdAt: string;
};

type JobsResponse = {
  items: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const PAGE_SIZE = 50;

export default function Jobs() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData<JobsResponse>(
    `/api/admin/jobs?page=${page}&limit=${PAGE_SIZE}`,
    { items: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 },
  );

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;

  const items = data.items || [];
  const start = data.total ? (data.page - 1) * data.limit + 1 : 0;
  const end = Math.min(data.page * data.limit, data.total);

  return (
    <div className="admin-catalog-page">
      <div className="admin-title">
        <div>
          <h1>Background Jobs</h1>
          <p>Email, tracking and integration job history from the backend.</p>
        </div>
      </div>
      <div className="admin-list-container">
        <AdminListView
          rows={items}
          label="Background jobs"
          paginationStyle="products"
          search={(job) =>
            `${job.name} ${job.status} ${job.orderId || ""} ${job.error || ""}`
          }
          searchHint="Search jobs on this page"
          sorts={[
            {
              label: "Created",
              value: (job) => Date.parse(job.createdAt) || 0,
            },
            { label: "Attempts", value: (job) => Number(job.attempts) || 0 },
          ]}
          filters={[
            { label: "Status", value: (job) => job.status },
            { label: "Job", value: (job) => job.name },
          ]}
          metrics={[
            { label: "Loaded jobs", value: (rows) => rows.length },
            {
              label: "Failed on page",
              value: (rows) =>
                rows.filter((job) => job.status === "FAILED").length,
            },
            {
              label: "Queued on page",
              value: (rows) =>
                rows.filter((job) => job.status === "QUEUED").length,
            },
            {
              label: "Succeeded on page",
              value: (rows) =>
                rows.filter((job) => job.status === "SUCCEEDED").length,
            },
          ]}
          onRefresh={reload}
        >
          {(visibleRows) => (
            <AdminTable scrollLabel="Jobs" className="admin-modern-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Order</th>
                  <th>Error</th>
                  <th>Retry</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((job) => (
                  <tr key={job.id}>
                    <td>{new Date(job.createdAt).toLocaleString("en-PK")}</td>
                    <td>{job.name}</td>
                    <td>{job.status}</td>
                    <td>{job.attempts}</td>
                    <td>{job.orderId || "—"}</td>
                    <td style={{ maxWidth: 360, whiteSpace: "normal" }}>
                      {job.error || "—"}
                    </td>
                    <td>
                      {["FAILED", "SKIPPED", "QUEUED"].includes(job.status) && (
                        <button
                          className="admin-btn admin-btn-light"
                          onClick={async () => {
                            try {
                              await clientApi(
                                `/api/admin/jobs/${job.id}/retry`,
                                { method: "POST" },
                                true,
                              );
                              await reload();
                            } catch (retryError) {
                              notifyError(retryError);
                            }
                          }}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminListView>
        <footer className="admin-table-footer admin-list-products-pagination">
          <span className="admin-table-count-text">
            Showing <b>{start}</b> to <b>{end}</b> of <b>{data.total}</b> jobs
          </span>
          <nav
            className="admin-pagination-controls"
            aria-label="Background jobs server pagination"
          >
            <button
              type="button"
              className="admin-page-btn"
              aria-label="Previous jobs page"
              disabled={data.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              &lt;
            </button>
            <span>
              Page {data.page} of {data.totalPages}
            </span>
            <button
              type="button"
              className="admin-page-btn"
              aria-label="Next jobs page"
              disabled={data.page >= data.totalPages}
              onClick={() =>
                setPage((current) => Math.min(data.totalPages, current + 1))
              }
            >
              &gt;
            </button>
          </nav>
        </footer>
      </div>
    </div>
  );
}
