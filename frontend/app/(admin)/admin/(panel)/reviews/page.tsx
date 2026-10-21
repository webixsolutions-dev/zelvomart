"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Plus,
  Upload,
  Download,
  History,
  Search,
  RefreshCw,
  Star,
  Clock3,
  CheckCircle2,
  FlaskConical,
  SlidersHorizontal,
  Pencil,
  Check,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Inbox,
  ShieldCheck,
  ArchiveRestore,
} from "lucide-react";
import { clientApi } from "@/lib/client-api";
import { useAdminData } from "@/components/admin/useAdminData";
import { Button, Select, Modal, Rating, Badge, Attachments } from "./controls";
import ReviewEditor from "./ReviewEditor";
import ImportPanel, { download } from "./ImportPanel";
import {
  day,
  statusLabel,
  type Product,
  type Review,
  type Batch,
} from "./types";
import "./reviews.css";

type Notice = { kind: "success" | "error"; text: string };
export default function Reviews() {
  const { data, setData, loading, error, reload } = useAdminData<Review[]>(
    "/api/admin/reviews",
    [],
  );
  const [products, setProducts] = useState<Product[]>([]),
    [batches, setBatches] = useState<Batch[]>([]),
    [auxError, setAuxError] = useState(""),
    [notice, setNotice] = useState<Notice>(),
    [panel, setPanel] = useState<"add" | "demo" | "import" | "history" | "">(
      "",
    ),
    [editing, setEditing] = useState<Review>(),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: () => Promise<void>;
    }>(),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState("all"),
    [query, setQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [productFilter, setProductFilter] = useState(""),
    [ratingFilter, setRatingFilter] = useState(""),
    [batchFilter, setBatchFilter] = useState(""),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [sort, setSort] = useState("newest"),
    [advanced, setAdvanced] = useState(false),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const locked = useRef(false);
  async function loadAux() {
    const results = await Promise.allSettled([
      clientApi<Product[]>("/api/admin/reviews/products", {}, true),
      clientApi<Batch[]>("/api/admin/reviews/batches", {}, true),
    ]);
    const failed: string[] = [];
    if (results[0].status === "fulfilled") setProducts(results[0].value);
    else failed.push("Products could not be loaded.");
    if (results[1].status === "fulfilled") setBatches(results[1].value);
    else failed.push("Import history could not be loaded.");
    setAuxError(failed.join(" "));
  }
  useEffect(() => {
    void loadAux();
  }, []);
  async function refresh() {
    const [reviews] = await Promise.all([reload(), loadAux()]);
    if (!reviews)
      throw new Error("Could not refresh reviews. Please try again.");
  }
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      await action();
    } catch (e) {
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "Action failed. Please retry.",
      });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function saved(review: Review) {
    setData((all) => [review, ...all.filter((r) => r.id !== review.id)]);
    setEditing(undefined);
    setPanel("");
    setNotice({
      kind: "success",
      text: `${review.origin === "TEST" ? "Demo review" : "Review"} ${review.status === "APPROVED" ? "approved and saved" : "saved"}${review.origin === "TEST" ? " · admin only." : "."}`,
    });
    const updated = await reload();
    if (!updated)
      setNotice({
        kind: "error",
        text: "Review was saved, but the list could not refresh. Use Refresh to retry.",
      });
  }
  async function moderate(ids: string[], status: string) {
    let succeeded = 0;
    const failures: string[] = [];
    for (const id of ids) {
      try {
        const updated = await clientApi<Review>(
          `/api/admin/reviews/${id}`,
          { method: "PATCH", body: JSON.stringify({ status }) },
          true,
        );
        setData((all) =>
          all.map((r) => (r.id === id ? { ...r, ...updated } : r)),
        );
        succeeded++;
      } catch {
        failures.push(id);
      }
    }
    setSelected(failures);
    setNotice({
      kind: failures.length ? "error" : "success",
      text: `${succeeded} review${succeeded === 1 ? "" : "s"} ${statusLabel(status).toLowerCase()}.${failures.length ? ` ${failures.length} failed; they remain selected so you can retry.` : ""}`,
    });
    await reload();
  }
  const tabs = [
    { value: "all", label: "All reviews", count: data.length },
    {
      value: "pending",
      label: "Pending",
      count: data.filter((r) => r.status === "PENDING").length,
    },
    {
      value: "imported",
      label: "Imported",
      count: data.filter((r) => r.origin === "IMPORTED").length,
    },
    {
      value: "demo",
      label: "Demo reviews",
      count: data.filter((r) => r.origin === "TEST").length,
    },
  ];
  const filtered = useMemo(() => {
    const list = data.filter(
      (r) =>
        (tab === "all" ||
          (tab === "pending" && r.status === "PENDING") ||
          (tab === "imported" && r.origin === "IMPORTED") ||
          (tab === "demo" && r.origin === "TEST")) &&
        (!statusFilter || r.status === statusFilter) &&
        (!productFilter || r.productId === productFilter) &&
        (!ratingFilter || r.rating === Number(ratingFilter)) &&
        (!batchFilter || r.batchId === batchFilter) &&
        (!dateFrom || (r.reviewDate || r.createdAt).slice(0, 10) >= dateFrom) &&
        (!dateTo || (r.reviewDate || r.createdAt).slice(0, 10) <= dateTo) &&
        `${r.product?.title} ${r.product?.sku} ${r.name} ${r.email || ""} ${r.body} ${r.reviewRef || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );
    return [...list].sort((a, b) =>
      sort === "rating-high"
        ? b.rating - a.rating
        : sort === "rating-low"
          ? a.rating - b.rating
          : sort === "oldest"
            ? (a.reviewDate || a.createdAt).localeCompare(
                b.reviewDate || b.createdAt,
              )
            : (b.reviewDate || b.createdAt).localeCompare(
                a.reviewDate || a.createdAt,
              ),
    );
  }, [
    data,
    tab,
    query,
    statusFilter,
    productFilter,
    ratingFilter,
    batchFilter,
    dateFrom,
    dateTo,
    sort,
  ]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    currentPage = Math.min(page, pages),
    visible = filtered.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    ),
    approved = data.filter(
      (r) => r.status === "APPROVED" && r.origin !== "TEST",
    ),
    avg = approved.length
      ? (
          approved.reduce((sum, r) => sum + r.rating, 0) / approved.length
        ).toFixed(1)
      : "—";
  const hasFilters = !!(
      query ||
      statusFilter ||
      productFilter ||
      ratingFilter ||
      batchFilter ||
      dateFrom ||
      dateTo
    ),
    allVisible =
      !!visible.length && visible.every((r) => selected.includes(r.id));
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [
    tab,
    query,
    statusFilter,
    productFilter,
    ratingFilter,
    batchFilter,
    dateFrom,
    dateTo,
    sort,
    pageSize,
  ]);
  function clearFilters() {
    setQuery("");
    setStatusFilter("");
    setProductFilter("");
    setRatingFilter("");
    setBatchFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }
  function toggleSelected(id: string, checked: boolean) {
    setSelected((all) =>
      checked ? [...new Set([...all, id])] : all.filter((x) => x !== id),
    );
  }
  function confirmReviewDelete(review: Review) {
    setConfirm({
      title: "Delete review?",
      description: `Remove the review by ${review.name} for ${review.product?.title}? It will disappear from public pages and rating calculations. The record is retained in the audit history.`,
      action: async () => {
        await clientApi(
          `/api/admin/reviews/${review.id}`,
          { method: "DELETE" },
          true,
        );
        setData((all) => all.filter((r) => r.id !== review.id));
        setSelected((all) => all.filter((id) => id !== review.id));
        setConfirm(undefined);
        setNotice({ kind: "success", text: "Review deleted." });
        await reload();
      },
    });
  }
  function deleteBatch(batch: Batch) {
    const count = data.filter((r) => r.batchId === batch.id).length;
    setConfirm({
      title: "Delete this import batch?",
      description: `This removes ${count} reviews from “${batch.filename}”. Other imported batches, manual reviews and customer submissions stay untouched. You can restore this batch from Import history.`,
      action: async () => {
        await clientApi(
          `/api/admin/reviews/batches/${batch.id}`,
          { method: "DELETE", body: JSON.stringify({ confirmCount: count }) },
          true,
        );
        setConfirm(undefined);
        await refresh();
        setNotice({
          kind: "success",
          text: `Batch deleted. ${count} reviews removed.`,
        });
      },
    });
  }
  return (
    <div className="reviews-workspace">
      <header className="rw-page-head">
        <div>
          <div className="rw-title-line">
            <span className="rw-page-icon">
              <MessageSquare size={21} />
            </span>
            <h1>Reviews</h1>
          </div>
          <p>Customer feedback, thoughtfully managed.</p>
        </div>
        <div className="rw-page-actions">
          <Button disabled={busy} onClick={() => setPanel("history")}>
            <History size={16} />
            Import history
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(() =>
                download("/api/admin/reviews/template", "review-template.csv"),
              )
            }
          >
            <Download size={16} />
            CSV template
          </Button>
          <Button disabled={busy} onClick={() => setPanel("import")}>
            <Upload size={16} />
            Import reviews
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => setPanel("add")}
          >
            <Plus size={17} />
            Add review
          </Button>
        </div>
      </header>
      {(notice || error || auxError) && (
        <div
          className={`rw-notice ${notice?.kind === "error" || error || auxError ? "is-error" : "is-success"}`}
          role={
            notice?.kind === "error" || error || auxError ? "alert" : "status"
          }
        >
          <span>
            {notice?.kind === "success" ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertCircle size={19} />
            )}
          </span>
          <p>{notice?.text || error || auxError}</p>
          {(error || auxError) && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void run(refresh)}
            >
              Retry
            </Button>
          )}
          <button
            type="button"
            className="rw-icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice(undefined)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <section className="rw-stats" aria-label="Review overview">
        {[
          {
            label: "Total reviews",
            value: data.length,
            detail: `${data.filter((r) => r.origin === "TEST").length} demo reviews`,
            icon: MessageSquare,
            tone: "blue",
          },
          {
            label: "Awaiting approval",
            value: data.filter((r) => r.status === "PENDING").length,
            detail: "Ready for your review",
            icon: Clock3,
            tone: "amber",
          },
          {
            label: "Published reviews",
            value: approved.length,
            detail: "Genuine, approved feedback",
            icon: CheckCircle2,
            tone: "green",
          },
          {
            label: "Average rating",
            value: avg,
            detail: approved.length
              ? `Across ${approved.length} published reviews`
              : "No published ratings yet",
            icon: Star,
            tone: "violet",
          },
        ].map(({ label, value, detail, icon: Icon, tone }) => (
          <article key={label}>
            <div>
              <span>{label}</span>
              <strong>{loading ? "—" : value}</strong>
              <small>{detail}</small>
            </div>
            <span className={`rw-stat-icon tone-${tone}`}>
              <Icon size={21} />
            </span>
          </article>
        ))}
      </section>
      <section className="rw-list-panel">
        <div className="rw-list-heading">
          <div>
            <h2>
              Review inbox <span>{data.length}</span>
            </h2>
            <p>Approve, edit and manage every review in one place.</p>
          </div>
          <Button
            variant="ghost"
            disabled={busy}
            busy={busy}
            onClick={() => void run(refresh)}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>
        <div className="rw-tabs" role="tablist" aria-label="Review views">
          {tabs.map((t) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              key={t.value}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              <span>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="rw-toolbar">
          <label className="rw-search">
            <Search size={17} />
            <input
              aria-label="Search reviews"
              type="search"
              placeholder="Search reviewer, product or review…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <Select
            label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All statuses" },
              ...["PENDING", "APPROVED", "REJECTED"].map((value) => ({
                value,
                label: statusLabel(value),
              })),
            ]}
          />
          <Select
            label="Filter by product"
            value={productFilter}
            onChange={setProductFilter}
            searchable
            options={[
              { value: "", label: "All products" },
              ...products.map((p) => ({
                value: p.id,
                label: p.title,
                detail: p.sku,
              })),
            ]}
          />
          <Button
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            <SlidersHorizontal size={16} />
            Filters
            {(ratingFilter || batchFilter || dateFrom || dateTo) && (
              <span className="rw-filter-dot" />
            )}
          </Button>
        </div>
        {advanced && (
          <div className="rw-advanced">
            <div className="rw-field">
              <span>Rating</span>
              <Select
                label="Filter by rating"
                value={ratingFilter}
                onChange={setRatingFilter}
                options={[
                  { value: "", label: "All ratings" },
                  ...[5, 4, 3, 2, 1].map((n) => ({
                    value: String(n),
                    label: `${n} star${n > 1 ? "s" : ""}`,
                  })),
                ]}
              />
            </div>
            <div className="rw-field">
              <span>Import batch</span>
              <Select
                label="Filter by batch"
                value={batchFilter}
                onChange={setBatchFilter}
                searchable
                options={[
                  { value: "", label: "All batches" },
                  ...batches
                    .filter((b) => !b.deletedAt)
                    .map((b) => ({
                      value: b.id,
                      label: b.filename,
                      detail: b.id,
                    })),
                ]}
              />
            </div>
            <label className="rw-field">
              From date
              <input
                aria-label="Reviews from date"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="rw-field">
              To date
              <input
                aria-label="Reviews to date"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <Button
              variant="ghost"
              disabled={!hasFilters}
              onClick={clearFilters}
            >
              Reset filters
            </Button>
          </div>
        )}
        <div className="rw-results-bar">
          <span>
            {filtered.length} {filtered.length === 1 ? "review" : "reviews"}
            {hasFilters ? " matching filters" : ""}
            {hasFilters && (
              <button
                type="button"
                className="rw-text-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </span>
          <Select
            label="Sort reviews"
            value={sort}
            onChange={setSort}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "rating-high", label: "Highest rating" },
              { value: "rating-low", label: "Lowest rating" },
            ]}
          />
        </div>
        {selected.length > 0 && (
          <div className="rw-bulk-bar">
            <strong>{selected.length} selected</strong>
            <Button
              disabled={busy}
              onClick={() => void run(() => moderate(selected, "APPROVED"))}
            >
              <Check size={15} />
              Approve selected
            </Button>
            <Button
              disabled={busy}
              onClick={() => void run(() => moderate(selected, "REJECTED"))}
            >
              <X size={15} />
              Reject selected
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setSelected([])}
            >
              Clear selection
            </Button>
            <span>Demo reviews remain admin only.</span>
          </div>
        )}
        {loading ? (
          <div className="rw-empty">
            <RefreshCw className="rw-spin" size={24} />
            <h3>Loading reviews…</h3>
          </div>
        ) : !visible.length ? (
          <div className="rw-empty">
            <span className="rw-empty-icon">
              {hasFilters ? <Search size={29} /> : <Inbox size={30} />}
            </span>
            <h3>
              {hasFilters
                ? "No matching reviews"
                : tab === "pending"
                  ? "All caught up"
                  : tab === "demo"
                    ? "Try your first demo review"
                    : "Your review inbox starts here"}
            </h3>
            <p>
              {hasFilters
                ? "Try a different search or reset your filters."
                : "Add customer feedback manually, import a CSV, or test the full workflow with a demo review."}
            </p>
            <div>
              {hasFilters ? (
                <Button onClick={clearFilters}>Reset filters</Button>
              ) : (
                <>
                  <Button variant="primary" onClick={() => setPanel("add")}>
                    <Plus size={16} />
                    Add a review
                  </Button>
                  <Button onClick={() => setPanel("demo")}>
                    <FlaskConical size={16} />
                    Try a demo review
                  </Button>
                </>
              )}
            </div>
            <small>
              Demo reviews are labelled and never appear on public product
              pages.
            </small>
          </div>
        ) : (
          <div className="rw-table-scroll">
            <table className="rw-table">
              <thead>
                <tr>
                  <th className="rw-check-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all visible reviews"
                      checked={allVisible}
                      disabled={busy}
                      onChange={(e) => {
                        setSelected((all) =>
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...all,
                                  ...visible.map((r) => r.id),
                                ]),
                              ]
                            : all.filter(
                                (id) => !visible.some((r) => r.id === id),
                              ),
                        );
                      }}
                    />
                  </th>
                  <th>Reviewer & product</th>
                  <th>Review</th>
                  <th>Status</th>
                  <th>Review date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className={selected.includes(r.id) ? "is-selected" : ""}
                  >
                    <td className="rw-check-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select review by ${r.name}`}
                        checked={selected.includes(r.id)}
                        disabled={busy}
                        onChange={(e) => toggleSelected(r.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <div className="rw-table-reviewer">
                        <span className="rw-avatar">
                          {r.avatarUrl ? (
                            <img src={r.avatarUrl} alt="" />
                          ) : (
                            r.name.trim().charAt(0).toUpperCase()
                          )}
                        </span>
                        <div>
                          <strong>{r.name}</strong>
                          <small>{r.email || "No email provided"}</small>
                        </div>
                      </div>
                      <div className="rw-table-product">
                        <strong>
                          {r.product?.title || "Product unavailable"}
                        </strong>
                        <small>{r.product?.sku}</small>
                      </div>
                    </td>
                    <td>
                      <Rating value={r.rating} />
                      <p className="rw-review-excerpt">{r.body}</p>
                      <Attachments media={r.media || []} />
                      <span className="rw-source-label">
                        {r.origin === "IMPORTED"
                          ? "CSV import"
                          : r.origin === "TEST"
                            ? "Demo review"
                            : r.origin === "MANUAL"
                              ? "Manually added"
                              : "Customer submission"}
                        {r.verified && (
                          <span>
                            <ShieldCheck size={12} />
                            Verified purchase
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <Badge status={r.status} />
                      {r.origin === "TEST" && (
                        <div className="rw-test-row">
                          <Badge status="TEST" test />
                        </div>
                      )}
                    </td>
                    <td className="rw-date-cell">
                      <time
                        dateTime={(r.reviewDate || r.createdAt).slice(0, 10)}
                      >
                        {day(r.reviewDate || r.createdAt)}
                      </time>
                      <small>
                        {r.reviewRef?.slice(0, 18)}
                        {(r.reviewRef?.length || 0) > 18 ? "…" : ""}
                      </small>
                    </td>
                    <td>
                      <div className="rw-row-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Edit review by ${r.name}`}
                          disabled={busy}
                          onClick={() => setEditing(r)}
                        >
                          <Pencil size={15} />
                          Edit
                        </Button>
                        {r.status !== "APPROVED" && (
                          <button
                            type="button"
                            className="rw-action-icon rw-action-approve"
                            aria-label={`Approve review by ${r.name}`}
                            title="Approve review"
                            disabled={busy}
                            onClick={() =>
                              void run(() => moderate([r.id], "APPROVED"))
                            }
                          >
                            <Check size={17} />
                          </button>
                        )}
                        {r.status !== "REJECTED" && (
                          <button
                            type="button"
                            className="rw-action-icon"
                            aria-label={`Reject review by ${r.name}`}
                            title="Reject review"
                            disabled={busy}
                            onClick={() =>
                              void run(() => moderate([r.id], "REJECTED"))
                            }
                          >
                            <X size={17} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="rw-action-icon rw-action-delete"
                          aria-label={`Delete review by ${r.name}`}
                          title="Delete review"
                          disabled={busy}
                          onClick={() => confirmReviewDelete(r)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="rw-pagination">
          <span>
            {filtered.length
              ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} reviews`
              : "0 reviews"}
          </span>
          <div>
            <Select
              label="Reviews per page"
              value={String(pageSize)}
              onChange={(v) => setPageSize(Number(v))}
              options={[10, 25, 50].map((n) => ({
                value: String(n),
                label: `${n} / page`,
              }))}
            />
            <button
              type="button"
              className="rw-icon-button"
              aria-label="Previous review page"
              disabled={currentPage <= 1}
              onClick={() => {
                setPage(currentPage - 1);
                setSelected([]);
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {currentPage} / {pages}
            </span>
            <button
              type="button"
              className="rw-icon-button"
              aria-label="Next review page"
              disabled={currentPage >= pages}
              onClick={() => {
                setPage(currentPage + 1);
                setSelected([]);
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </section>
      <div className="rw-bottom-note">
        <ShieldCheck size={15} />
        <p>
          Only approved genuine reviews contribute to public ratings.{" "}
          <button
            type="button"
            className="rw-text-button"
            onClick={() => setPanel("demo")}
          >
            Try a demo review
          </button>
        </p>
      </div>
      {(panel === "add" || panel === "demo" || editing) && (
        <ReviewEditor
          key={editing?.id || panel}
          products={products}
          review={editing}
          demo={panel === "demo"}
          onClose={() => {
            setEditing(undefined);
            setPanel("");
          }}
          onSaved={saved}
        />
      )}
      {panel === "import" && (
        <ImportPanel
          products={products}
          onClose={() => setPanel("")}
          onImported={async (batch) => {
            setPanel("history");
            await refresh();
            setNotice({
              kind: "success",
              text: `${batch.imported} imported · ${batch.skipped} skipped · ${batch.failed} failed. Reviews are Pending.`,
            });
          }}
        />
      )}
      {panel === "history" && (
        <Modal
          title="Import history"
          description="Track each batch, download errors or recover deleted reviews."
          onClose={() => setPanel("")}
          wide
          busy={busy}
        >
          <div className="rw-history-body">
            {notice && (
              <div
                className={`rw-notice ${notice.kind === "error" ? "is-error" : "is-success"}`}
                role={notice.kind === "error" ? "alert" : "status"}
              >
                <p>{notice.text}</p>
              </div>
            )}
            {!batches.length ? (
              <div className="rw-empty">
                <History size={32} />
                <h3>No imports yet</h3>
                <p>Every completed import will appear here with its results.</p>
                <Button variant="primary" onClick={() => setPanel("import")}>
                  Import reviews
                </Button>
              </div>
            ) : (
              <div className="rw-history-list">
                {batches.map((b) => (
                  <article key={b.id}>
                    <span className="rw-history-icon">
                      <History size={21} />
                    </span>
                    <div className="rw-history-details">
                      <h3>
                        {b.filename}
                        {b.deletedAt && (
                          <span className="rw-badge rw-badge-rejected">
                            Deleted · recoverable
                          </span>
                        )}
                      </h3>
                      <p>
                        {day(b.createdAt)} <span>·</span>
                        <code>{b.id}</code>
                      </p>
                      <div className="rw-history-counts">
                        <span>
                          <b>{b.imported}</b> imported
                        </span>
                        <span>
                          <b>{b.skipped}</b> skipped
                        </span>
                        <span className={b.failed ? "rw-field-error" : ""}>
                          <b>{b.failed}</b> failed
                        </span>
                      </div>
                    </div>
                    <div className="rw-history-actions">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            download(
                              `/api/admin/reviews/batches/${b.id}/errors`,
                              "review-errors.csv",
                            ),
                          )
                        }
                      >
                        <Download size={15} />
                        Error CSV
                      </Button>
                      {b.deletedAt ? (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await clientApi(
                                `/api/admin/reviews/batches/${b.id}/restore`,
                                { method: "POST" },
                                true,
                              );
                              await refresh();
                              setNotice({
                                kind: "success",
                                text: "Batch restored as Pending. Review it before approving.",
                              });
                            })
                          }
                        >
                          <ArchiveRestore size={15} />
                          Restore as Pending
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() => deleteBatch(b)}
                        >
                          <Trash2 size={15} />
                          Delete batch (
                          {data.filter((r) => r.batchId === b.id).length})
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <footer className="rw-modal-footer">
            <p>Batch deletion leaves other reviews untouched.</p>
            <Button onClick={() => setPanel("")}>Done</Button>
          </footer>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          description={confirm.description}
          onClose={() => setConfirm(undefined)}
          busy={busy}
        >
          <div className="rw-confirm-icon">
            <Trash2 size={28} />
          </div>
          {notice?.kind === "error" && (
            <div className="rw-form-alert" role="alert">
              {notice.text}
            </div>
          )}
          <footer className="rw-modal-footer">
            <Button onClick={() => setConfirm(undefined)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => void run(confirm.action)}
            >
              Confirm deletion
            </Button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
