"use client";

import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import { clearAdminDataCache } from "@/components/admin/useAdminData";
import { adminFetch, clientApi } from "@/lib/client-api";
import BulkImageUpload from "@/components/admin/BulkImageUpload";
import type { BulkProduct } from "@/lib/bulk-images";

type CsvRow = Record<string, string | number>;
type ImportPhase = "ready" | "saving" | "saved" | "posting" | "posted" | "error";
type ImportItem = {
  row: number;
  sku: string;
  title: string;
  productType: string;
  variations: number;
  category: string;
  categoryId: string | null;
  /** The CSV category is not one of the store's categories (shown until one is picked). */
  categoryError?: string;
  action: string;
  errors: string[];
  warnings: string[];
  id: string | null;
  status: string | null;
  phase: ImportPhase;
  rows: CsvRow[];
};
type ImportCategory = { id: string; name: string; slug: string };
type ImportResponse = {
  created: number;
  exists: number;
  skipped: number;
  fileErrors?: string[];
  fileWarnings?: string[];
  categories?: ImportCategory[];
  results: Array<Omit<ImportItem, "phase" | "rows">>;
};
const IMPORT_CHUNK = 15;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

// Keeps the spreadsheet line number on every row so messages point at the right line.
function toRows(table: string[][]) {
  const headers = (table[0] || []).map((header) => header.trim());
  if (headers.length === 1 && /[;\t]/.test(headers[0])) {
    throw new Error("This file is not comma-separated. In Excel choose Save As → CSV UTF-8 (Comma delimited), then import it again.");
  }
  if (headers.filter(Boolean).length < 2) throw new Error("The first line must be the template header row (type, title, sku…).");
  const rows: CsvRow[] = [];
  table.slice(1).forEach((cells, index) => {
    if (!cells.some((value) => value.trim())) return;
    if (cells.length > headers.length && cells.slice(headers.length).some((value) => value.trim())) {
      throw new Error(`Row ${index + 2} has more cells than the header row. A cell that contains a comma must be wrapped in double quotes.`);
    }
    const row: CsvRow = { __row: index + 2 };
    headers.forEach((header, i) => {
      if (header) row[header] = String(cells[i] ?? "").trim();
    });
    rows.push(row);
  });
  if (!rows.length) throw new Error("The CSV has a header row but no product rows.");
  return { headers, rows };
}

function cellOf(row: CsvRow, ...names: string[]) {
  for (const [header, value] of Object.entries(row)) {
    if (names.includes(header.toLowerCase().replace(/[^a-z0-9]+/g, ""))) return String(value || "").trim();
  }
  return "";
}

// A product is its own row plus the variation rows that point at it.
function groupRows(rows: CsvRow[]) {
  const groups = new Map<number, CsvRow[]>();
  const bySku = new Map<string, CsvRow[]>();
  let last: CsvRow[] | null = null;
  const pending: CsvRow[] = [];
  for (const row of rows) {
    const type = cellOf(row, "type", "producttype").toLowerCase();
    const parent = cellOf(row, "parentsku", "parent").toLowerCase();
    if (type.startsWith("variation") || (!type && parent)) {
      const target = parent ? bySku.get(parent) : last;
      if (target) target.push(row);
      else pending.push(row);
      continue;
    }
    const group = [row];
    groups.set(Number(row.__row), group);
    const sku = cellOf(row, "sku").toLowerCase();
    if (sku && !bySku.has(sku)) bySku.set(sku, group);
    last = group;
  }
  for (const row of pending) {
    const target = bySku.get(cellOf(row, "parentsku", "parent").toLowerCase());
    if (target) target.push(row);
    else groups.set(Number(row.__row), [row]);
  }
  return groups;
}

async function download(path: string, name: string) {
  const response = await adminFetch(path);
  if (!response.ok) throw new Error("Download failed");
  saveBlob(await response.blob(), name);
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/_/g, " ") : fallback;
}

export default function ProductAdminTools({
  onImported,
  products = [],
  compact = false,
}: {
  onImported?: () => void;
  products?: BulkProduct[];
  compact?: boolean;
}) {
  const csvRef = useRef<HTMLInputElement>(null);
  const csvDialogRef = useRef<HTMLDialogElement>(null);

  const [fileName, setFileName] = useState("");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [csvError, setCsvError] = useState("");
  const [csvProblems, setCsvProblems] = useState<string[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvNote, setCsvNote] = useState("");
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
  const [categories, setCategories] = useState<ImportCategory[]>([]);
  const [csvBusy, setCsvBusy] = useState(false);

  function refresh() {
    clearAdminDataCache("/api/admin/products");
    clearAdminDataCache("/api/admin/categories");
    onImported?.();
  }

  function patchItems(rows: number[], patch: (item: ImportItem) => Partial<ImportItem>) {
    setItems((current) => current.map((item) => (rows.includes(item.row) ? { ...item, ...patch(item) } : item)));
  }

  async function onCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setItems([]);
    setCsvError("");
    setCsvProblems([]);
    setCsvWarnings([]);
    setCsvNote("");
    setFileName(file.name);
    setCsvBusy(true);
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error("Choose a .csv file. An Excel file (.xlsx) must be saved as CSV UTF-8 first.");
      const text = await file.text();
      if (!text.trim()) throw new Error("The file is empty.");
      if (text.includes("\u0000")) throw new Error("This is not a text CSV file. Save it as CSV UTF-8 and import it again.");
      const { headers, rows } = toRows(parseCsv(text));
      const groups = groupRows(rows);
      // Dry run: the server checks the header row and every row. Nothing is saved yet.
      const response = await clientApi<ImportResponse>("/api/admin/products/import", { method: "POST", body: JSON.stringify({ headers, rows, dryRun: true }) }, true);
      setCsvWarnings(response.fileWarnings || []);
      setCategories(response.categories || []);
      if (response.fileErrors?.length) {
        setCsvError("This file does not follow the template. Fix the points below and import it again. Nothing was saved.");
        setCsvProblems(response.fileErrors);
        return;
      }
      setCsvHeaders(headers);
      setItems(
        response.results.map((result) => ({
          ...result,
          phase: result.action === "create" ? "ready" : "error",
          rows: groups.get(result.row) || [],
        })),
      );
    } catch (error) {
      setCsvError(message(error, "Unable to read the CSV"));
    } finally {
      setCsvBusy(false);
    }
  }

  async function saveDrafts(targets: ImportItem[]) {
    const ready = targets.filter((item) => item.phase === "ready" && item.rows.length && item.categoryId);
    if (!ready.length || csvBusy) return;
    setCsvBusy(true);
    setCsvError("");
    setCsvNote("");
    let created = 0;
    let failed = 0;
    try {
      for (let start = 0; start < ready.length; start += IMPORT_CHUNK) {
        const chunk = ready.slice(start, start + IMPORT_CHUNK);
        const rows = chunk.map((item) => item.row);
        patchItems(rows, () => ({ phase: "saving" }));
        try {
          const response = await clientApi<ImportResponse>(
            "/api/admin/products/import",
            {
              method: "POST",
              body: JSON.stringify({
                headers: csvHeaders,
                rows: chunk.flatMap((item) => item.rows),
                categoryByRow: Object.fromEntries(chunk.map((item) => [item.row, item.categoryId])),
              }),
            },
            true,
          );
          const byRow = new Map(response.results.map((result) => [result.row, result]));
          created += response.created;
          failed += response.skipped;
          patchItems(rows, (item) => {
            const result = byRow.get(item.row);
            if (!result) return { phase: "error", errors: ["The server did not return a result for this row."] };
            if (result.action === "error" || result.action === "exists") return { ...result, categoryId: item.categoryId, phase: "error" };
            return { ...result, categoryId: item.categoryId, phase: result.status === "PUBLISHED" ? "posted" : "saved" };
          });
        } catch (error) {
          failed += chunk.length;
          patchItems(rows, () => ({ phase: "error", errors: [message(error, "Import failed")] }));
        }
      }
      setCsvNote(`${created} added to drafts${failed ? `, ${failed} not saved` : ""}.`);
      refresh();
    } finally {
      setCsvBusy(false);
    }
  }

  async function postProducts(targets: ImportItem[]) {
    const drafts = targets.filter((item) => item.phase === "saved" && item.id);
    if (!drafts.length || csvBusy) return;
    setCsvBusy(true);
    setCsvError("");
    const rows = drafts.map((item) => item.row);
    patchItems(rows, () => ({ phase: "posting" }));
    try {
      const response = await clientApi<{ updated: string[]; failed: { id: string; error: string }[] }>(
        "/api/admin/products/bulk-status",
        { method: "POST", body: JSON.stringify({ ids: drafts.map((item) => item.id), status: "PUBLISHED" }) },
        true,
      );
      const failures = new Map(response.failed.map((entry) => [entry.id, entry.error]));
      patchItems(rows, (item) =>
        response.updated.includes(String(item.id))
          ? { phase: "posted", status: "PUBLISHED", warnings: [] }
          : { phase: "saved", warnings: [failures.get(String(item.id)) || "Could not post this product."] },
      );
      setCsvNote(`${response.updated.length} posted${response.failed.length ? `, ${response.failed.length} not posted` : ""}.`);
      refresh();
    } catch (error) {
      patchItems(rows, () => ({ phase: "saved" }));
      setCsvError(message(error, "Posting failed"));
    } finally {
      setCsvBusy(false);
    }
  }

  const readyItems = items.filter((item) => item.phase === "ready");
  const savedItems = items.filter((item) => item.phase === "saved");
  const existsCount = items.filter((item) => item.action === "exists").length;
  // The import starts only when every row to be saved has one of the store's categories.
  const missingCategory = readyItems.filter((item) => !item.categoryId).length;

  return (
    <div className={`admin-product-actions${compact ? " compact" : ""}`}>
      <BulkImageUpload products={products} onUploaded={refresh} />
      <button
        type="button"
        className="admin-btn-outline"
        onClick={() => csvDialogRef.current?.showModal()}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Import CSV</span>
      </button>

      <dialog ref={csvDialogRef} className="admin-modal admin-modal-xl">
        <div className="admin-modal-shell">
          <div className="admin-modal-head">
            <div>
              <h2>Import Products from CSV</h2>
              <p>New products only, saved as drafts. A row whose SKU, slug or title is already in the shop is skipped as “Already exists”.</p>
            </div>
            <button type="button" className="admin-modal-close" onClick={() => csvDialogRef.current?.close()}>×</button>
          </div>
          <div className="admin-modal-body">
            <div className="admin-import-templates">
              <span>Templates</span>
              <button type="button" className="admin-btn admin-btn-light" onClick={() => download("/api/admin/product-import/template/simple", "zelvomart-simple-products-template.csv").catch((error) => setCsvError(message(error, "Download failed")))}>
                Simple products CSV
              </button>
              <button type="button" className="admin-btn admin-btn-light" onClick={() => download("/api/admin/product-import/template/variable", "zelvomart-variable-products-template.csv").catch((error) => setCsvError(message(error, "Download failed")))}>
                Variable products CSV
              </button>
            </div>
            <div className="admin-import-drop" onClick={() => csvRef.current?.click()}>
              <span className="admin-import-symbol">CSV</span>
              <div>
                <b>{fileName || "Choose CSV file"}</b>
                <p>Simple or variable template (one row per product). Every row is checked first; nothing is saved until you add it to drafts.</p>
              </div>
              <button type="button" className="admin-btn admin-btn-light">Browse</button>
              <input ref={csvRef} hidden type="file" accept=".csv,text/csv" onChange={onCsvFile} />
            </div>
            {csvBusy && !items.length ? <div className="admin-import-message">Checking the file…</div> : null}
            {csvError ? (
              <div className="admin-import-message error">
                {csvError}
                {csvProblems.length ? (
                  <ul className="admin-import-problems">
                    {csvProblems.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {csvWarnings.length ? (
              <div className="admin-import-message warning">
                The file was read with these warnings:
                <ul className="admin-import-problems">
                  {csvWarnings.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {csvNote ? <div className="admin-import-message success">{csvNote}</div> : null}
            {items.length ? (
              <>
                <div className="admin-import-summary">
                  <b>
                    {items.length} product{items.length === 1 ? "" : "s"} in file
                  </b>
                  <span>
                    {readyItems.length} ready · {savedItems.length} in drafts · {items.filter((item) => item.phase === "posted").length} posted · {existsCount} already exist · {items.filter((item) => item.phase === "error").length - existsCount} with errors
                  </span>
                </div>
                <div className="admin-table-wrap admin-import-preview">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Product</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Result</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.row}>
                          <td>{item.row}</td>
                          <td>
                            <b>{item.title || "—"}</b>
                            <small className="admin-import-sub">{item.sku || "No SKU"}</small>
                          </td>
                          <td>{item.productType === "variable" ? `Variable · ${item.variations}` : "Simple"}</td>
                          <td>
                            {item.phase === "ready" ? (
                              <select
                                className={`admin-import-category${item.categoryId ? "" : " missing"}`}
                                value={item.categoryId || ""}
                                disabled={csvBusy}
                                onChange={(event) => patchItems([item.row], () => ({ categoryId: event.target.value || null }))}
                              >
                                <option value="">Choose category…</option>
                                {categories.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            {item.phase === "ready" && item.categoryError && !item.categoryId ? <small className="admin-import-sub error">{item.categoryError}</small> : null}
                            {item.phase === "ready" ? null : (
                              categories.find((category) => category.id === item.categoryId)?.name || item.category || "—"
                            )}
                          </td>
                          <td>
                            <span className={`admin-import-state ${item.action === "exists" ? "exists" : item.phase}`}>
                              {item.phase === "ready" ? "New" : null}
                              {item.phase === "saving" ? "Saving…" : null}
                              {item.phase === "saved" ? "In drafts" : null}
                              {item.phase === "posting" ? "Posting…" : null}
                              {item.phase === "posted" ? "Posted" : null}
                              {item.phase === "error" ? (item.action === "exists" ? "Already exists" : "Error") : null}
                            </span>
                            {[...item.errors, ...item.warnings].map((text) => (
                              <small key={text} className={`admin-import-sub${item.errors.includes(text) ? " error" : " warning"}`}>{text}</small>
                            ))}
                          </td>
                          <td>
                            <div className="admin-import-row-actions">
                              {item.phase === "ready" ? (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-light"
                                  disabled={csvBusy || !item.categoryId}
                                  title={item.categoryId ? undefined : "Choose a category first"}
                                  onClick={() => saveDrafts([item])}
                                >
                                  Add to draft
                                </button>
                              ) : null}
                              {item.phase === "saved" ? (
                                <button type="button" className="admin-btn admin-btn-primary" disabled={csvBusy} onClick={() => postProducts([item])}>
                                  Post
                                </button>
                              ) : null}
                              {item.id && (item.phase === "saved" || item.phase === "posted") ? (
                                <Link className="admin-row-edit-link" href={`/admin/products/${item.id}`} target="_blank">
                                  Edit
                                </Link>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            <div className="admin-modal-footer-actions">
              <button type="button" className="admin-btn admin-btn-light" onClick={() => csvDialogRef.current?.close()}>Close</button>
              <button type="button" className="admin-btn admin-btn-light" disabled={!savedItems.length || csvBusy} onClick={() => postProducts(savedItems)}>
                Post all drafts{savedItems.length ? ` (${savedItems.length})` : ""}
              </button>
              {missingCategory ? (
                <span className="admin-import-sub error">
                  Choose a category on {missingCategory} row{missingCategory === 1 ? "" : "s"} first.
                </span>
              ) : null}
              <button type="button" className="admin-btn admin-btn-primary" disabled={!readyItems.length || missingCategory > 0 || csvBusy} onClick={() => saveDrafts(readyItems)}>
                {csvBusy && items.some((item) => item.phase === "saving") ? "Saving…" : `Add all to drafts${readyItems.length ? ` (${readyItems.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      </dialog>

    </div>
  );
}
