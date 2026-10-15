"use client";

import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import { clearAdminDataCache } from "@/components/admin/useAdminData";
import { adminFetch, clientApi, uploadAdminImage } from "@/lib/client-api";
import {
  checkImageStructure,
  imageExtension,
  imageMime,
  type BulkProduct,
  type ImageGroup,
  type ImageProblem,
  type SourceFile,
} from "@/lib/bulk-images";
import { readZip } from "@/lib/zip-reader";

type CsvRow = Record<string, string | number>;
type ImportPhase = "ready" | "saving" | "saved" | "posting" | "posted" | "error";
type ImportItem = {
  row: number;
  sku: string;
  title: string;
  productType: string;
  variations: number;
  category: string;
  action: string;
  errors: string[];
  warnings: string[];
  id: string | null;
  status: string | null;
  phase: ImportPhase;
  rows: CsvRow[];
};
type ImportResponse = { created: number; updated: number; skipped: number; fileErrors?: string[]; results: Array<Omit<ImportItem, "phase" | "rows">> };
type ImageRow = {
  group: ImageGroup;
  state: "ready" | "uploading" | "done" | "error";
  message: string;
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
  const zipRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const csvDialogRef = useRef<HTMLDialogElement>(null);
  const imageDialogRef = useRef<HTMLDialogElement>(null);

  const [fileName, setFileName] = useState("");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [csvError, setCsvError] = useState("");
  const [csvProblems, setCsvProblems] = useState<string[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvNote, setCsvNote] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);

  const [imageRows, setImageRows] = useState<ImageRow[]>([]);
  const [problems, setProblems] = useState<ImageProblem[]>([]);
  const [imageFiles, setImageFiles] = useState<SourceFile[]>([]);
  const [imageSource, setImageSource] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [replaceImages, setReplaceImages] = useState(false);

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
      if (response.fileErrors?.length) {
        setCsvError("This file does not follow the template. Fix the points below and import it again. Nothing was saved.");
        setCsvProblems(response.fileErrors);
        return;
      }
      setCsvHeaders(headers);
      setItems(
        response.results.map((result) => ({
          ...result,
          phase: result.action === "error" ? "error" : "ready",
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
    const ready = targets.filter((item) => item.phase === "ready" && item.rows.length);
    if (!ready.length || csvBusy) return;
    setCsvBusy(true);
    setCsvError("");
    setCsvNote("");
    let created = 0;
    let updated = 0;
    let failed = 0;
    try {
      for (let start = 0; start < ready.length; start += IMPORT_CHUNK) {
        const chunk = ready.slice(start, start + IMPORT_CHUNK);
        const rows = chunk.map((item) => item.row);
        patchItems(rows, () => ({ phase: "saving" }));
        try {
          const response = await clientApi<ImportResponse>(
            "/api/admin/products/import",
            { method: "POST", body: JSON.stringify({ headers: csvHeaders, rows: chunk.flatMap((item) => item.rows) }) },
            true,
          );
          const byRow = new Map(response.results.map((result) => [result.row, result]));
          created += response.created;
          updated += response.updated;
          failed += response.skipped;
          patchItems(rows, (item) => {
            const result = byRow.get(item.row);
            if (!result) return { phase: "error", errors: ["The server did not return a result for this row."] };
            if (result.action === "error") return { ...result, phase: "error" };
            return { ...result, phase: result.status === "PUBLISHED" ? "posted" : "saved" };
          });
        } catch (error) {
          failed += chunk.length;
          patchItems(rows, () => ({ phase: "error", errors: [message(error, "Import failed")] }));
        }
      }
      setCsvNote(`${created} added to drafts, ${updated} updated${failed ? `, ${failed} failed` : ""}.`);
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

  async function prepareImages(files: SourceFile[], label: string, replace: boolean) {
    setImageBusy(true);
    setImageError("");
    setImageNote("");
    setImageRows([]);
    setProblems([]);
    try {
      if (!products.length) throw new Error("Products are still loading. Wait a moment and choose the file again.");
      const check = await checkImageStructure(files, products, replace);
      setImageFiles(files);
      setImageSource(label);
      setProblems(check.problems);
      setImageRows(check.groups.map((group) => ({ group, state: "ready", message: "" })));
    } catch (error) {
      setImageFiles([]);
      setImageError(message(error, "Unable to read the images"));
    } finally {
      setImageBusy(false);
    }
  }

  async function onZipFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setImageBusy(true);
    setImageError("");
    try {
      const sources: SourceFile[] = [];
      for (const file of files) {
        if (!/\.zip$/i.test(file.name)) throw new Error(`"${file.name}" is not a ZIP file. RAR and 7z are not supported; create a normal .zip.`);
        const entries = await readZip(file);
        if (!entries.length) throw new Error(`"${file.name}" is empty.`);
        // The ZIP name counts as the top folder, so a ZIP named after one product SKU also works.
        const prefix = `${file.name.replace(/\.zip$/i, "")}/`;
        for (const entry of entries) sources.push({ path: `${prefix}${entry.path}`, size: entry.size, load: entry.blob, head: entry.head });
      }
      await prepareImages(sources, files.map((file) => file.name).join(", "), replaceImages);
    } catch (error) {
      setImageRows([]);
      setProblems([]);
      setImageFiles([]);
      setImageBusy(false);
      setImageError(message(error, "Unable to open the ZIP"));
    }
  }

  async function onFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const sources: SourceFile[] = files.map((file) => ({
      path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      size: file.size,
      load: async () => file,
      head: async () => new Uint8Array(await file.slice(0, 16).arrayBuffer()),
    }));
    await prepareImages(sources, "selected folder", replaceImages);
  }

  async function uploadImages() {
    if (imageBusy || problems.length || !imageRows.some((row) => row.state === "ready")) return;
    setImageBusy(true);
    setImageError("");
    let uploadedTotal = 0;
    let productTotal = 0;
    let failedTotal = 0;
    for (const target of imageRows) {
      if (target.state !== "ready") continue;
      const { product } = target.group;
      const update = (patch: Partial<ImageRow>) =>
        setImageRows((current) => current.map((row) => (row.group.product.id === product.id ? { ...row, ...patch } : row)));
      update({ state: "uploading", message: "Uploading…" });
      const cache = new Map<string, string>();
      const slug = product.slug || "product";
      let counter = 0;
      // One failed image stops this product: a half-uploaded gallery is never saved.
      const send = async (sources: SourceFile[]) => {
        const urls: string[] = [];
        for (const source of sources) {
          let url = cache.get(source.path);
          if (!url) {
            counter += 1;
            const blob = await source.load();
            url = await uploadAdminImage(new File([blob], `${slug}-${counter}.${imageExtension(source.path)}`, { type: imageMime(source.path) }));
            cache.set(source.path, url);
          }
          urls.push(url);
        }
        return urls;
      };
      try {
        const images = await send(target.group.images);
        const variantImages: Record<string, string[]> = {};
        for (const [variantId, entry] of target.group.variantImages) variantImages[variantId] = await send(entry.images);
        const variantCount = Object.keys(variantImages).length;
        await clientApi(
          `/api/admin/products/${product.id}/images`,
          { method: "POST", body: JSON.stringify({ images, variantImages, mode: replaceImages ? "replace" : "append", featuredFirst: target.group.hasFeatured }) },
          true,
        );
        productTotal += 1;
        uploadedTotal += cache.size;
        update({
          state: "done",
          message: `${images.length} product image${images.length === 1 ? "" : "s"}${variantCount ? `, ${variantCount} variation${variantCount === 1 ? "" : "s"}` : ""} saved`,
        });
      } catch (error) {
        failedTotal += 1;
        update({ state: "error", message: `${message(error, "Upload failed")} Nothing was saved for this product.` });
      }
    }
    setImageNote(`${uploadedTotal} images saved to ${productTotal} product${productTotal === 1 ? "" : "s"}.`);
    if (failedTotal) setImageError(`${failedTotal} product${failedTotal === 1 ? "" : "s"} failed. Their images were not saved; fix the problem and upload those folders again.`);
    setImageBusy(false);
    refresh();
  }

  function downloadImageList() {
    const lines = ["folderName,title,slug,status,currentImages,variationFolders"];
    for (const product of products) {
      lines.push(
        [
          product.sku,
          product.title || product.name,
          product.slug,
          product.status,
          (product.rawImages || []).length,
          (product.variants || []).map((variant) => variant.sku).filter(Boolean).join(" | "),
        ]
          .map(csvCell)
          .join(","),
      );
    }
    saveBlob(new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/csv" }), "zelvomart-image-folders.csv");
  }

  const readyItems = items.filter((item) => item.phase === "ready");
  const savedItems = items.filter((item) => item.phase === "saved");
  const readyImages = imageRows.filter((row) => row.state === "ready");

  return (
    <div className={`admin-product-actions${compact ? " compact" : ""}`}>
      <button
        type="button"
        className="admin-btn-outline"
        onClick={() => imageDialogRef.current?.showModal()}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>Upload Image ZIP</span>
      </button>
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
              <p>New SKUs are saved as drafts. Existing SKUs are updated and keep their status.</p>
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
                <p>Simple or variable template. Every row is checked first; nothing is saved until you add it to drafts.</p>
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
            {csvNote ? <div className="admin-import-message success">{csvNote}</div> : null}
            {items.length ? (
              <>
                <div className="admin-import-summary">
                  <b>
                    {items.length} product{items.length === 1 ? "" : "s"} in file
                  </b>
                  <span>
                    {readyItems.length} ready · {savedItems.length} in drafts · {items.filter((item) => item.phase === "posted").length} posted · {items.filter((item) => item.phase === "error").length} with errors
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
                          <td>{item.category || "—"}</td>
                          <td>
                            <span className={`admin-import-state ${item.phase}`}>
                              {item.phase === "ready" ? (item.action === "update" ? "Will update" : "New") : null}
                              {item.phase === "saving" ? "Saving…" : null}
                              {item.phase === "saved" ? "In drafts" : null}
                              {item.phase === "posting" ? "Posting…" : null}
                              {item.phase === "posted" ? "Posted" : null}
                              {item.phase === "error" ? "Error" : null}
                            </span>
                            {[...item.errors, ...item.warnings].map((text) => (
                              <small key={text} className={`admin-import-sub${item.errors.includes(text) ? " error" : ""}`}>{text}</small>
                            ))}
                          </td>
                          <td>
                            <div className="admin-import-row-actions">
                              {item.phase === "ready" ? (
                                <button type="button" className="admin-btn admin-btn-light" disabled={csvBusy} onClick={() => saveDrafts([item])}>
                                  {item.action === "update" ? "Update" : "Add to draft"}
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
              <button type="button" className="admin-btn admin-btn-primary" disabled={!readyItems.length || csvBusy} onClick={() => saveDrafts(readyItems)}>
                {csvBusy && items.some((item) => item.phase === "saving") ? "Saving…" : `Add all to drafts${readyItems.length ? ` (${readyItems.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      </dialog>

      <dialog ref={imageDialogRef} className="admin-modal admin-modal-xl">
        <div className="admin-modal-shell">
          <div className="admin-modal-head">
            <div>
              <h2>Upload Product Images</h2>
              <p>One folder per product, named with the product SKU. The image named 1 is the featured image.</p>
            </div>
            <button type="button" className="admin-modal-close" onClick={() => imageDialogRef.current?.close()}>×</button>
          </div>
          <div className="admin-modal-body">
            <div className="admin-import-templates">
              <span>Before you start</span>
              <button type="button" className="admin-btn admin-btn-light" disabled={!products.length} onClick={downloadImageList}>
                Folder names CSV
              </button>
              <label className="admin-import-check">
                <input type="checkbox" checked={replaceImages} disabled={imageBusy} onChange={(event) => {
                    setReplaceImages(event.target.checked);
                    if (imageFiles.length) void prepareImages(imageFiles, imageSource, event.target.checked);
                  }}
                />
                Replace existing images
              </label>
            </div>
            <div className="admin-import-drop" onClick={() => zipRef.current?.click()}>
              <span className="admin-import-symbol">ZIP</span>
              <div>
                <b>{imageSource || "Choose image ZIP"}</b>
                <p>Only the template structure is accepted: a folder named with the SKU, 1.jpg as the featured image, then the rest of the images. JPG, PNG, WEBP, GIF or AVIF, 8 MB each.</p>
              </div>
              <button type="button" className="admin-btn admin-btn-light">Browse</button>
              <input ref={zipRef} hidden type="file" accept=".zip,application/zip,application/x-zip-compressed" multiple onChange={onZipFiles} />
            </div>
            <button type="button" className="admin-import-alt" onClick={() => folderRef.current?.click()}>
              or choose an unzipped folder
            </button>
            <input ref={folderRef} hidden type="file" multiple onChange={onFolder} {...({ webkitdirectory: "", directory: "" } as any)} />
            {imageBusy && !imageRows.length ? <div className="admin-import-message">Checking every file against the template structure…</div> : null}
            {imageError ? <div className="admin-import-message error">{imageError}</div> : null}
            {imageNote ? <div className="admin-import-message success">{imageNote}</div> : null}
            {problems.length ? (
              <div className="admin-import-message error">
                {problems.length} problem{problems.length === 1 ? "" : "s"} found. The files do not follow the template structure, so nothing was uploaded. Fix {problems.length === 1 ? "it" : "them"} and choose the ZIP again.
                <ul className="admin-import-problems">
                  {problems.slice(0, 60).map((entry) => (
                    <li key={`${entry.where}|${entry.message}`}>
                      {entry.where ? <b>{entry.where}</b> : null}
                      {entry.message}
                    </li>
                  ))}
                  {problems.length > 60 ? <li>…and {problems.length - 60} more.</li> : null}
                </ul>
              </div>
            ) : null}
            {imageRows.length ? (
              <>
                <div className="admin-import-summary">
                  <b>
                    {imageRows.length} product folder{imageRows.length === 1 ? "" : "s"} {problems.length ? "valid" : "ready"}
                  </b>
                  <span>{problems.length ? "Upload is blocked until every problem is fixed" : "Structure check passed"}</span>
                </div>
                <div className="admin-table-wrap admin-import-preview">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Has now</th>
                        <th>Product images</th>
                        <th>Variation images</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imageRows.map((row) => (
                        <tr key={row.group.product.id}>
                          <td>
                            <b>{row.group.product.title || row.group.product.name || "Untitled"}</b>
                            <small className="admin-import-sub">{row.group.product.sku}</small>
                          </td>
                          <td>{(row.group.product.rawImages || []).length}</td>
                          <td>{row.group.images.length}</td>
                          <td>
                            {[...row.group.variantImages.values()].map((entry) => (
                              <small key={entry.variant.id} className="admin-import-sub">
                                {entry.variant.name || entry.variant.sku}: {entry.images.length}
                              </small>
                            ))}
                            {!row.group.variantImages.size ? "—" : null}
                          </td>
                          <td>
                            <span className={`admin-import-state ${row.state === "done" ? "posted" : row.state === "uploading" ? "saving" : row.state}`}>
                              {row.state === "ready" ? "Ready" : row.state === "error" ? "Failed" : row.message}
                            </span>
                            {row.state === "error" ? <small className="admin-import-sub error">{row.message}</small> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            <div className="admin-modal-footer-actions">
              <button type="button" className="admin-btn admin-btn-light" onClick={() => imageDialogRef.current?.close()}>Close</button>
              <button type="button" className="admin-btn admin-btn-primary" disabled={!readyImages.length || imageBusy || problems.length > 0} onClick={uploadImages}>
                {imageBusy && imageRows.length ? "Uploading…" : `Upload images to ${readyImages.length || ""} product${readyImages.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
