"use client";
import ReplayStatCards from "@/components/admin/ReplayStatCards";
import AdminTable from "@/components/admin/AdminTable";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrderData } from "../orders/useOrderData";
import { Skeleton } from "../orders/OrderSkeletons";
import { setSessionReplayOptOut } from "@/lib/session-replay-client";
import { SITE_ORIGIN } from "@/lib/site-url";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { clientApi } from "@/lib/client-api";
import { notifyError } from "@/lib/app-errors";
import { toast } from "react-toastify";
import "../orders/orders.css";
import "./replays.css";
type Replay = {
  lastSeenAt: string;
  eventCount: number;
  viewport?: string;
  referrer?: string;
  orderDestination?: string;
  order?: { orderNumber: string };
  id: string;
  visitorId: string;
  source: string;
  campaign?: string;
  landingUrl: string;
  device?: string;
  startedAt: string;
  durationMs: number;
  pageViews: number;
  reachedCart: boolean;
  reachedCheckout: boolean;
  ordered: boolean;
};
type List = {
  storageConfigured?: boolean;
  total: number;
  items: Replay[];
  page: number;
  totalPages: number;
  stats: { ordered30: number };
};
const duration = (ms: number) =>
  `${Math.floor(ms / 60000)}m ${Math.floor(ms / 1000) % 60}s`;
const pagePath = (url: string) => {
  try {
    return new URL(url || "/", SITE_ORIGIN).pathname;
  } catch {
    return url || "/";
  }
};
export default function Replays() {
  const search = useSearchParams();
  const role = useAdminRole();
  const canDelete = role === "OWNER" || role === "MANAGER";
  const [outcome, setOutcome] = useState("cart-no-order"),
    [source, setSource] = useState(""),
    [q, setQ] = useState(""),
    [campaign, setCampaign] = useState(""),
    [device, setDevice] = useState(""),
    [product, setProduct] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [minDuration, setMinDuration] = useState(10),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [excluded, setExcluded] = useState(false),
    [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<string[]>([]),
    [deleting, setDeleting] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [typedConfirmation, setTypedConfirmation] = useState("");
  useEffect(() => {
    setExcluded(localStorage.getItem("zm_session_replay_opt_out") === "1");
    for (const [key, setter] of [
      ["outcome", setOutcome],
      ["from", setFrom],
      ["to", setTo],
    ] as const) {
      const value = search.get(key);
      if (value) setter(value);
    }
  }, [search]);
  useEffect(
    () => setPage(1),
    [
      outcome,
      source,
      q,
      campaign,
      device,
      product,
      from,
      to,
      minDuration,
      pageSize,
      sort,
    ],
  );
  const path = useMemo(() => {
    const params = new URLSearchParams({
      outcome,
      sort,
      page: String(page),
      limit: String(pageSize),
      minDuration: String(minDuration),
    });
    for (const [key, value] of Object.entries({
      q,
      source,
      campaign,
      device,
      product,
      from,
      to,
      visitor: search.get("visitor") || "",
    }))
      if (value) params.set(key, value);
    return `/api/admin/session-replays?${params}`;
  }, [
    outcome,
    page,
    pageSize,
    minDuration,
    q,
    source,
    campaign,
    device,
    product,
    from,
    to,
    search,
    sort,
  ]);
  useEffect(() => setSelected([]), [path]);
  const { data, loading, error, reload } = useOrderData<List>(path);
  async function deleteSelected() {
    if (!selected.length || deleting) return;
    const count = selected.length;
    if (count > 10 && typedConfirmation !== "DELETE") return;
    setDeleting(true);
    try {
      const result = await clientApi<{
        deleted: string[];
        skipped: string[];
        errors: { id: string; error: string }[];
        storageErrors: { id: string; error: string; storageKeys: string[] }[];
      }>(
        "/api/admin/session-replays/bulk-delete",
        {
          method: "POST",
          body: JSON.stringify({
            ids: selected,
            confirmationCount: count,
            typedConfirmation,
          }),
        },
        true,
      );
      setSelected([]);
      setConfirmDelete(false);
      setTypedConfirmation("");
      const details = [
        `${result.deleted.length} recording${result.deleted.length === 1 ? "" : "s"} deleted`,
        result.skipped.length ? `${result.skipped.length} skipped` : "",
        result.errors.length
          ? `${result.errors.length} database error${result.errors.length === 1 ? "" : "s"}`
          : "",
        result.storageErrors.length
          ? `${result.storageErrors.length} R2 cleanup error${result.storageErrors.length === 1 ? "" : "s"}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const failedKeys = result.storageErrors.flatMap(
        (item) => item.storageKeys,
      );
      const description = failedKeys.length
        ? `${details}. Failed R2 keys: ${failedKeys.join(", ")}`
        : details;
      if (result.errors.length) toast.error(description, { autoClose: 4000 });
      else if (result.storageErrors.length)
        toast.warning(description, { autoClose: 4000 });
      else toast.success(description, { autoClose: 3000 });
      await reload();
    } catch (error) {
      notifyError(error);
    } finally {
      setDeleting(false);
    }
  }
  useEffect(() => {
    if (outcome !== "live") return;
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [outcome, reload]);
  return (
    <div className="od-dashboard replay-list">
      <div className="admin-title">
        <div>
          <h1>Session Replays</h1>
          <p>Watch customer journeys and find where shoppers drop off.</p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={excluded}
            onChange={(e) => {
              setExcluded(e.target.checked);
              setSessionReplayOptOut(e.target.checked);
            }}
          />{" "}
          Exclude this device
        </label>
      </div>
      {data && data.storageConfigured === false && (
        <div className="replay-storage-warning" role="alert">
          <b>Recording is off: the private R2 bucket is not configured.</b>
          <span>
            No visitor is being recorded. Recordings are stored only in
            Cloudflare R2, never in the database. Set REPLAY_S3_BUCKET (with the
            S3_ENDPOINT and S3 access keys) on the backend, then redeploy.
          </span>
        </div>
      )}
      <ReplayStatCards
        loading={loading && !data}
        items={[
          {
            label: "Matching recordings",
            value: data?.total || 0,
            description: "With selected filters",
          },
          {
            label: "Orders with recordings",
            value: data?.stats?.ordered30 || 0,
            description: "Selected date range",
          },
          {
            label: "Privacy protection",
            value: "Masked",
            description: "Personal inputs hidden",
          },
        ]}
      />
      <section className="od-panel">
        <div className="od-tabs" role="tablist" aria-label="Replay outcome">
          {[
            ["all", "All recordings"],
            ["live", "Live now"],
            ["cart-no-order", "Cart abandoned"],
            ["checkout-no-order", "Checkout abandoned"],
            ["ordered", "Ordered"],
            ["visitor-no-product", "No product viewed"],
            ["product-no-cart", "Product, no cart"],
            ["cart-no-checkout", "Cart, no checkout"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={outcome === value ? "active" : ""}
              role="tab"
              aria-selected={outcome === value}
              onClick={() => setOutcome(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="replay-filter-heading">
          <b>Filter recordings</b>
          <div>
            <label>
              Sort by{" "}
              <select
                aria-label="Sort recordings"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="duration">Longest duration</option>
              </select>
            </label>
            {(q ||
              source ||
              campaign ||
              device ||
              product ||
              from ||
              to ||
              minDuration !== 10 ||
              search.get("visitor")) && (
              <button
                className="admin-btn admin-btn-light"
                onClick={() => {
                  setQ("");
                  setSource("");
                  setCampaign("");
                  setDevice("");
                  setProduct("");
                  setFrom("");
                  setTo("");
                  setMinDuration(10);
                  if (search.get("visitor"))
                    window.location.assign("/admin/session-replays");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="od-filters">
          <input
            aria-label="Search sessions"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search page or visitor…"
          />
          <select
            aria-label="Replay source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">All sources</option>
            {["facebook", "instagram", "tiktok", "google", "direct"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <input
            aria-label="Campaign"
            placeholder="Campaign"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          />
          <select
            aria-label="Device"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">All devices</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
          <input
            aria-label="Product page"
            placeholder="Product page / slug"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Min. seconds
            <input
              type="number"
              min={10}
              max={86400}
              value={minDuration}
              onChange={(e) =>
                setMinDuration(Math.max(10, Number(e.target.value)))
              }
            />
          </label>
        </div>
        {error && (
          <div className="replay-filter-heading">
            <span>Recordings could not be loaded.</span>
            <button
              className="admin-btn admin-btn-light"
              onClick={() => void reload()}
            >
              Try again
            </button>
          </div>
        )}
        {canDelete && selected.length > 0 && (
          <div className="od-bulk">
            <b>{selected.length} selected</b>
            <button
              className="admin-btn admin-btn-danger"
              disabled={deleting}
              onClick={() => setConfirmDelete(true)}
            >
              Delete selected
            </button>
            <button
              className="admin-btn admin-btn-light"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </div>
        )}
        <AdminTable scrollLabel="Session replays" className="admin-table">
          <thead>
            <tr>
              {canDelete && (
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select recordings on this page"
                    checked={
                      Boolean(data?.items?.length) &&
                      data!.items.every((row) => selected.includes(row.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [
                              ...new Set([
                                ...selected,
                                ...(data?.items || []).map((row) => row.id),
                              ]),
                            ]
                          : selected.filter(
                              (id) =>
                                !data?.items?.some((row) => row.id === id),
                            ),
                      )
                    }
                  />
                </th>
              )}
              {[
                "Started",
                "Visitor / source",
                "Device",
                "Landing page",
                "Pages",
                "Duration",
                "Furthest step",
                "Outcome",
                "Campaign",
                "Order destination",
                "Viewport",
                "Events",
                "Last activity",
                "Order",
                "Watch",
              ].map((value) => (
                <th key={value}>{value}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: pageSize }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 15 }, (_, j) => (
                      <td key={j}>
                        <Skeleton width={65} />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.items?.map((row) => (
                  <tr key={row.id}>
                    {canDelete && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select recording ${row.visitorId.slice(0, 8)}`}
                          checked={selected.includes(row.id)}
                          onChange={(e) =>
                            setSelected((current) =>
                              e.target.checked
                                ? [...current, row.id]
                                : current.filter((id) => id !== row.id),
                            )
                          }
                        />
                      </td>
                    )}
                    <td>
                      {new Date(row.startedAt).toLocaleString("en-PK", {
                        timeZone: "Asia/Karachi",
                      })}
                    </td>
                    <td>
                      <b>#{row.visitorId.slice(0, 8)}</b>
                      <small>
                        {row.source} {row.campaign || ""}
                      </small>
                    </td>
                    <td>
                      {row.device === "mobile"
                        ? "Mobile"
                        : row.device === "desktop"
                          ? "Desktop"
                          : "Unknown"}
                    </td>
                    <td title={row.landingUrl}>{pagePath(row.landingUrl)}</td>
                    <td>{row.pageViews}</td>
                    <td>{duration(row.durationMs)}</td>
                    <td>
                      {row.ordered
                        ? "Purchase"
                        : row.reachedCheckout
                          ? "Checkout"
                          : row.reachedCart
                            ? "Add to cart"
                            : "Browse"}
                    </td>
                    <td>{row.ordered ? "Ordered" : "No order"}</td>
                    <td>{row.campaign || "—"}</td>
                    <td title="Shipping city supplied with the linked order; not visitor geolocation">
                      {row.orderDestination || "Unknown"}
                    </td>
                    <td>{row.viewport || "—"}</td>
                    <td>{row.eventCount ?? "—"}</td>
                    <td>
                      {row.lastSeenAt
                        ? new Date(row.lastSeenAt).toLocaleString("en-PK", {
                            timeZone: "Asia/Karachi",
                          })
                        : "—"}
                    </td>
                    <td>{row.order?.orderNumber || "—"}</td>
                    <td>
                      <Link
                        className="admin-btn admin-btn-primary"
                        href={`/admin/session-replays/${row.id}${outcome === "live" ? "?live=1" : ""}`}
                      >
                        {outcome === "live" ? "● Live" : "▷ Watch"}
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </AdminTable>
        {!loading && !data?.items?.length && !error && (
          <p className="od-empty">
            No playable recordings match these filters.
          </p>
        )}
        <footer className="od-pagination">
          <div className="replay-page-size">
            <label>
              Rows per page
              <select
                aria-label="Recordings per page"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <span>{data?.total || 0} recordings</span>
          </div>
          <div>
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {data?.totalPages || 1}
            </span>
            <button
              disabled={loading || page >= (data?.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
      <p className="od-footnote">
        Recordings show the visitor’s screen and scroll position. Only sessions
        with a snapshot and at least 10 seconds of activity appear. Personal
        inputs are masked. Order destination is the shipping city supplied with
        a linked order, not visitor geolocation. Unknown means no location was
        supplied.
      </p>
      {confirmDelete && (
        <div
          className="replay-delete-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setConfirmDelete(false);
              setTypedConfirmation("");
            }
          }}
        >
          <section
            className="replay-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replay-delete-title"
            aria-describedby="replay-delete-description"
            tabIndex={-1}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Escape" && !deleting) {
                setConfirmDelete(false);
                setTypedConfirmation("");
              }
            }}
          >
            <div className="replay-delete-icon" aria-hidden="true">
              !
            </div>
            <div className="replay-delete-copy">
              <span className="replay-delete-eyebrow">Permanent action</span>
              <h2 id="replay-delete-title">Delete selected recordings?</h2>
              <p id="replay-delete-description">
                This will permanently remove{" "}
                <strong>
                  {selected.length} recording{selected.length === 1 ? "" : "s"}
                </strong>{" "}
                and their database entries. We’ll also attempt to delete their
                files from Cloudflare R2.
              </p>
              {selected.length > 10 && (
                <label className="replay-delete-confirm-field">
                  Type <strong>DELETE</strong> to confirm this bulk removal.
                  <input
                    value={typedConfirmation}
                    onChange={(event) =>
                      setTypedConfirmation(event.target.value)
                    }
                    placeholder="Type DELETE"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              )}
            </div>
            <div className="replay-delete-actions">
              <button
                type="button"
                className="admin-btn admin-btn-light"
                disabled={deleting}
                onClick={() => {
                  setConfirmDelete(false);
                  setTypedConfirmation("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                disabled={
                  deleting ||
                  (selected.length > 10 && typedConfirmation !== "DELETE")
                }
                onClick={() => void deleteSelected()}
              >
                {deleting
                  ? "Deleting…"
                  : `Delete ${selected.length} recording${selected.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
