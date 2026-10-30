"use client";

/**
 * Admin → Products → Bulk rename. (1) download/copy current titles, paste "old title | new title | price |
 * sale price | SEO title | SEO description", (2) preview (nothing saved), (3) apply in one click, then a report
 * and "Undo last bulk rename". Rules and writes live in the backend (lib/bulk-rename.ts, routes/admin/bulk-rename.ts).
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { clearAdminDataCache } from "@/components/admin/useAdminData";

type Category = { id: string; name: string };
type Fields = { title: string; slug: string; price: number; salePrice: number | null; seoTitle: string | null; seoDescription: string | null };
type Row = {
  line: number;
  status: "ok" | "unchanged" | "error";
  reason?: string;
  product?: { id: string; title: string; slug: string; category: string | null; image: string | null };
  before?: Fields;
  after?: Fields;
  slugSuffixed?: boolean;
  seoTitleAction?: "set" | "follow" | "kept";
  seoDescriptionAction?: "set" | "kept";
  redirect?: "301" | "none";
  applied?: boolean;
  redirectCreated?: boolean;
};
type ExportRow = { title: string; category: string; price: number; salePrice: number | null; seoTitle: string; seoDescription: string };
type LastBatch = { batchId: string; at: string; count: number; undone: boolean } | null;

const money = (n: number | null | undefined) => (n == null ? "—" : `Rs ${Number(n).toLocaleString("en-PK")}`);
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
const tsvCell = (v: unknown) => (v == null ? "" : String(v).replace(/[\t\r\n]+/g, " "));

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const newBatchId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `b-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function seoNote(r: Row) {
  const parts = [];
  if (r.seoTitleAction === "set") parts.push("SEO title set");
  else if (r.seoTitleAction === "follow") parts.push("SEO title follows the title");
  else if (r.seoTitleAction === "kept") parts.push("SEO title kept");
  if (r.seoDescriptionAction === "set") parts.push("SEO description set");
  return parts.join(" · ");
}

export default function BulkRename() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [exportRows, setExportRows] = useState<ExportRow[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");
  const [redirect, setRedirect] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [last, setLast] = useState<LastBatch>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoResult, setUndoResult] = useState<{ title: string; status: string; reason?: string }[] | null>(null);
  const batchRef = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clientApi<Category[]>("/api/admin/categories", {}, true)
      .then((list) => setCategories(list.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => undefined);
    void loadLast();
  }, []);

  async function loadLast() {
    try {
      const res = await clientApi<{ batch: LastBatch }>("/api/admin/products/bulk-rename/last", {}, true);
      setLast(res.batch);
    } catch {
      setLast(null);
    }
  }

  // Any change to the input makes the old preview stale.
  function changed<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setRows(null);
      setReport(null);
    };
  }

  async function loadExport() {
    setExporting(true);
    setError("");
    try {
      const q = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
      const res = await clientApi<{ rows: ExportRow[] }>(`/api/admin/products/bulk-rename/export${q}`, {}, true);
      setExportRows(res.rows);
      return res.rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the products.");
      return null;
    } finally {
      setExporting(false);
    }
  }

  async function downloadCsv() {
    const list = (await loadExport()) || [];
    const name = categories.find((c) => c.id === categoryId)?.name || "all";
    download(
      `zelvomart-products-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
      toCsv([["title", "category", "price", "sale_price", "seo_title", "seo_description"], ...list.map((r) => [r.title, r.category, r.price, r.salePrice ?? "", r.seoTitle, r.seoDescription])]),
    );
  }

  async function copyList() {
    const list = exportRows || (await loadExport()) || [];
    const tsv = [["title", "category", "price", "sale_price", "seo_title", "seo_description"], ...list.map((r) => [r.title, r.category, r.price, r.salePrice ?? "", r.seoTitle, r.seoDescription])]
      .map((r) => r.map(tsvCell).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select the list and copy it by hand.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    changed(setText)(content);
  }

  async function preview() {
    setPreviewing(true);
    setError("");
    setReport(null);
    setUndoResult(null);
    try {
      const res = await clientApi<{ rows: Row[] }>(
        "/api/admin/products/bulk-rename/preview",
        { method: "POST", body: JSON.stringify({ text, categoryId: categoryId || null, redirect }) },
        true,
      );
      setRows(res.rows);
      batchRef.current = newBatchId();
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  const valid = useMemo(() => (rows || []).filter((r) => r.status === "ok"), [rows]);
  const urlChanges = valid.filter((r) => r.redirect).length;

  async function apply() {
    if (applying || !valid.length) return;
    setApplying(true);
    setError("");
    const batchId = batchRef.current || newBatchId();
    batchRef.current = batchId;
    const out: Row[] = [];
    try {
      for (let chunk = 0, chunks = 1; chunk < chunks; chunk++) {
        setProgress(chunks > 1 ? `Saving part ${chunk + 1} of ${chunks}…` : "Saving…");
        const res = await clientApi<{ chunks: number; rows: Row[] }>(
          "/api/admin/products/bulk-rename/apply",
          { method: "POST", body: JSON.stringify({ text, categoryId: categoryId || null, redirect, batchId, chunk }) },
          true,
        );
        chunks = res.chunks;
        out.push(...res.rows);
      }
      setReport(out);
      setRows(null);
      clearAdminDataCache();
      await loadLast();
    } catch (e) {
      if (out.length) setReport(out);
      setError(`${e instanceof Error ? e.message : "Apply failed."} Lines already saved are listed below; run Preview again for the rest.`);
    } finally {
      setApplying(false);
      setProgress("");
    }
  }

  function downloadReport() {
    if (!report) return;
    download(
      `bulk-rename-report-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`,
      toCsv([
        ["line", "result", "reason", "old_title", "new_title", "old_url", "new_url", "old_price", "new_price", "old_sale_price", "new_sale_price", "seo", "redirect_created"],
        ...report.map((r) => [
          r.line,
          r.applied ? "applied" : r.status === "unchanged" ? "no change" : "not applied",
          r.reason || "",
          r.before?.title ?? r.product?.title ?? "",
          r.after?.title ?? "",
          r.before ? `/product/${r.before.slug}/` : "",
          r.after ? `/product/${r.after.slug}/` : "",
          r.before?.price ?? "",
          r.after?.price ?? "",
          r.before?.salePrice ?? "",
          r.after?.salePrice ?? "",
          seoNote(r),
          r.applied ? (r.redirectCreated ? "yes" : "no") : "",
        ]),
      ]),
    );
  }

  async function undo() {
    if (!last || undoing) return;
    setUndoing(true);
    setError("");
    try {
      const res = await clientApi<{ results: { title: string; status: string; reason?: string }[] }>(
        "/api/admin/products/bulk-rename/undo",
        { method: "POST", body: JSON.stringify({ batchId: last.batchId }) },
        true,
      );
      setUndoResult(res.results);
      clearAdminDataCache();
      await loadLast();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Undo failed.");
    } finally {
      setUndoing(false);
    }
  }

  const shown = report || rows;
  return (
    <div className="bulk-rename">
      <div className="admin-page-head">
        <div>
          <Link href="/admin/products" className="bulk-rename-back">
            ← Products
          </Link>
          <h1>Bulk rename</h1>
          <p>Change many product titles (and prices or SEO text) at once. The URL, sitemap and feeds follow the new title.</p>
        </div>
      </div>

      <section className="admin-card bulk-rename-step">
        <h2>1. Your list</h2>
        <div className="bulk-rename-row">
          <label>
            Category
            <select value={categoryId} onChange={(e) => (changed(setCategoryId)(e.target.value), setExportRows(null))}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="admin-btn admin-btn-outline" onClick={downloadCsv} disabled={exporting}>
            {exporting ? "Loading…" : "Download products (CSV)"}
          </button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={copyList} disabled={exporting}>
            {copied ? "Copied" : "Copy list for Google Sheets"}
          </button>
        </div>
        {exportRows && (
          <details className="bulk-rename-export">
            <summary>
              {exportRows.length} product{exportRows.length === 1 ? "" : "s"} in this list
            </summary>
            <ul>
              {exportRows.slice(0, 300).map((r, i) => (
                <li key={i}>
                  {r.title} <span>· {r.category || "no category"} · {money(r.price)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <label className="bulk-rename-paste">
          Paste from your sheet: one product per line
          <textarea
            rows={8}
            value={text}
            onChange={(e) => changed(setText)(e.target.value)}
            placeholder={"old title | new title | new price | new sale price | new SEO title | new SEO description\nPink Marble Tumbler | Pink Marble Insulated Tumbler 1200ml | 1499"}
            spellCheck={false}
          />
        </label>
        <p className="bulk-rename-help">
          Columns separated by TAB (copy from Sheets/Excel) or <code>|</code>. Blank cell = leave unchanged. Sale price{" "}
          <code>-</code> = remove the sale price. Up to 500 lines. Or{" "}
          <button type="button" className="bulk-rename-link" onClick={() => fileRef.current?.click()}>
            upload a CSV
          </button>{" "}
          with the header <code>old_title,new_title,price,sale_price,seo_title,seo_description</code>.
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ""))} />
        </p>
        <label className="bulk-rename-check">
          <input type="checkbox" checked={redirect} onChange={(e) => changed(setRedirect)(e.target.checked)} />
          Create 301 redirect from the old URL
        </label>
        <div className="bulk-rename-row">
          <button type="button" className="admin-btn admin-btn-primary" onClick={preview} disabled={!text.trim() || previewing || applying}>
            {previewing ? "Checking…" : "Preview"}
          </button>
        </div>
        {error && <p className="bulk-rename-error">{error}</p>}
      </section>

      {previewing && (
        <section className="admin-card bulk-rename-step" aria-busy="true">
          <div className="bulk-rename-skeleton" />
          <div className="bulk-rename-skeleton" />
          <div className="bulk-rename-skeleton" />
        </section>
      )}

      {shown && !previewing && (
        <section className="admin-card bulk-rename-step">
          <h2>{report ? "3. Result" : "2. Preview (nothing is saved yet)"}</h2>
          {!report && urlChanges > 0 && (
            <p className="bulk-rename-note">
              {urlChanges} URL{urlChanges === 1 ? "" : "s"} will change.{" "}
              {redirect ? "Old links redirect automatically." : "Old links will stop working (fine for products that are not indexed yet)."}
            </p>
          )}
          {report && (
            <p className="bulk-rename-note">
              {report.filter((r) => r.applied).length} applied · {report.filter((r) => !r.applied && r.status === "unchanged").length} no change ·{" "}
              {report.filter((r) => r.status === "error").length} not applied
            </p>
          )}
          <div className="admin-table-wrap">
            <table className="bulk-rename-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Product</th>
                  <th>Title</th>
                  <th>URL</th>
                  <th>Price</th>
                  <th>SEO</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.line} className={`is-${r.applied ? "applied" : r.status}`}>
                    <td data-label="Line">{r.line}</td>
                    <td data-label="Product">
                      {r.product ? (
                        <span className="bulk-rename-product">
                          {r.product.image ? <img src={r.product.image} alt="" width={36} height={36} /> : <span className="bulk-rename-noimg" />}
                          <small>{r.product.category || "No category"}</small>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="Title">
                      {r.before && r.after && r.before.title !== r.after.title ? (
                        <>
                          <s>{r.before.title}</s>
                          <br />
                          <strong>{r.after.title}</strong>
                        </>
                      ) : (
                        r.after?.title || r.product?.title || "—"
                      )}
                    </td>
                    <td data-label="URL">
                      {r.before && r.after && r.before.slug !== r.after.slug ? (
                        <>
                          <s>/{r.before.slug}/</s>
                          <br />
                          <strong>/{r.after.slug}/</strong>
                          <em className={r.redirect === "301" ? "flag-ok" : "flag-warn"}>{r.redirect === "301" ? "URL changes + 301 redirect" : "URL changes, no redirect"}</em>
                          {r.slugSuffixed && <em className="flag-info">-number added: URL already used</em>}
                        </>
                      ) : r.after ? (
                        <span className="muted">unchanged</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="Price">
                      {r.before && r.after && (r.before.price !== r.after.price || r.before.salePrice !== r.after.salePrice) ? (
                        <>
                          {money(r.before.price)}
                          {r.before.salePrice != null && ` / sale ${money(r.before.salePrice)}`} →<br />
                          <strong>
                            {money(r.after.price)}
                            {r.after.salePrice != null ? ` / sale ${money(r.after.salePrice)}` : r.before.salePrice != null ? " (sale removed)" : ""}
                          </strong>
                        </>
                      ) : r.after ? (
                        <span className="muted">unchanged</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="SEO">{seoNote(r) || "—"}</td>
                    <td data-label="Notes">
                      {r.applied ? (
                        <span className="flag-ok">Applied{r.redirectCreated ? " · redirect created" : ""}</span>
                      ) : r.status === "unchanged" ? (
                        <span className="muted">{r.reason || "No change"}</span>
                      ) : r.status === "error" ? (
                        <span className="flag-err">{r.reason}</span>
                      ) : (
                        <span className="flag-ok">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bulk-rename-row">
            {report ? (
              <button type="button" className="admin-btn admin-btn-outline" onClick={downloadReport}>
                Download this report (CSV)
              </button>
            ) : (
              <button type="button" className="admin-btn admin-btn-primary" onClick={apply} disabled={!valid.length || applying}>
                {applying ? progress || "Saving…" : `Apply ${valid.length} change${valid.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        </section>
      )}

      {last && (
        <section className="admin-card bulk-rename-step">
          <h2>Last bulk rename</h2>
          <p className="bulk-rename-help">
            {new Date(last.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {last.count} product{last.count === 1 ? "" : "s"}
            {last.undone ? " · undone" : ""}
          </p>
          {!last.undone && (
            <button type="button" className="admin-btn admin-btn-outline" onClick={undo} disabled={undoing || applying}>
              {undoing ? "Undoing…" : "Undo last bulk rename"}
            </button>
          )}
          {undoResult && (
            <ul className="bulk-rename-undo">
              {undoResult.map((r, i) => (
                <li key={i} className={r.status === "restored" ? "flag-ok" : "flag-err"}>
                  {r.title}: {r.status === "restored" ? "restored" : `skipped (${r.reason})`}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
