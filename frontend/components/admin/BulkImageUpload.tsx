"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { clientApi, uploadAdminImage } from "@/lib/client-api";
import {
  hasFeaturedImage,
  matchImages,
  MAX_PRODUCT_IMAGES,
  nameKey,
  productName,
  sortImages,
  type BulkProduct,
  type ImageMatch,
  type SourceFile,
} from "@/lib/bulk-images";
import { readZip } from "@/lib/zip-reader";

// Images uploaded at the same time for one product.
const PARALLEL_UPLOADS = 4;

type Progress = { state: "ready" | "uploading" | "done" | "error"; done: number; total: number; message: string };
type Row = { product: BulkProduct; images: SourceFile[]; sources: string[]; hasFeatured: boolean; byHand: number };

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/_/g, " ") : fallback;
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

/** Thumbnail of a local file from the folder or ZIP; loaded only while it is on screen. */
function LocalThumb({ file }: { file: SourceFile }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let url = "";
    let alive = true;
    file
      .load()
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  return src ? <img className="admin-bulk-thumb" src={src} alt="" /> : <span className="admin-bulk-thumb empty" />;
}

async function withRetry<T>(task: () => Promise<T>) {
  try {
    return await task();
  } catch {
    return task();
  }
}

export default function BulkImageUpload({ products, onUploaded }: { products: BulkProduct[]; onUploaded?: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [folderLabel, setFolderLabel] = useState("No file chosen");
  const [zipLabel, setZipLabel] = useState("No file chosen");
  const [match, setMatch] = useState<ImageMatch | null>(null);
  // Unassigned file path -> product id picked by hand.
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const productOptions = useMemo(
    () => [...products].sort((a, b) => productName(a).localeCompare(productName(b), undefined, { sensitivity: "base" })),
    [products],
  );
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Matched groups plus the unassigned files the owner assigned by hand.
  const rows = useMemo<Row[]>(() => {
    if (!match) return [];
    const map = new Map<string, Row>();
    for (const group of match.groups) map.set(group.product.id, { product: group.product, images: [...group.images], sources: [...group.sources], hasFeatured: false, byHand: 0 });
    for (const item of match.unassigned) {
      const product = byId.get(picks[item.file.path] || "");
      if (!product) continue;
      const row = map.get(product.id) || { product, images: [], sources: [], hasFeatured: false, byHand: 0 };
      row.images.push(item.file);
      row.byHand += 1;
      map.set(product.id, row);
    }
    return [...map.values()].map((row) => {
      const images = sortImages(row.images);
      return { ...row, images, hasFeatured: hasFeaturedImage(images) };
    });
  }, [match, picks, byId]);

  const waiting = rows.filter((row) => (progress[row.product.id]?.state || "ready") === "ready");
  const waitingImages = waiting.reduce((sum, row) => sum + row.images.length, 0);
  const unassignedLeft = match ? match.unassigned.filter((item) => !picks[item.file.path]).length : 0;

  function reset() {
    setMatch(null);
    setPicks({});
    setProgress({});
    setError("");
    setNote("");
  }

  async function prepare(files: SourceFile[]) {
    reset();
    setBusy(true);
    try {
      if (!products.length) throw new Error("Products are still loading. Wait a moment and choose the files again.");
      const result = await matchImages(files, products);
      if (!result.imageCount && !result.skipped.length) throw new Error("No images were found. Use JPG, JPEG, PNG, WEBP or GIF files.");
      setMatch(result);
    } catch (problem) {
      setError(message(problem, "Unable to read the images"));
    } finally {
      setBusy(false);
    }
  }

  async function onFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const first = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || files[0].name;
    setFolderLabel(`${first.split("/")[0]} (${files.length} file${files.length === 1 ? "" : "s"})`);
    setZipLabel("No file chosen");
    await prepare(
      files.map((file) => ({
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        size: file.size,
        load: async () => file,
        head: async () => new Uint8Array(await file.slice(0, 16).arrayBuffer()),
      })),
    );
  }

  async function onZips(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setZipLabel(files.length === 1 ? files[0].name : `${files.length} ZIP files`);
    setFolderLabel("No file chosen");
    setBusy(true);
    try {
      const sources: SourceFile[] = [];
      for (const file of files) {
        if (!/\.zip$/i.test(file.name)) throw new Error(`"${file.name}" is not a ZIP file. RAR and 7z are not supported; create a normal .zip.`);
        const entries = await readZip(file);
        if (!entries.length) throw new Error(`"${file.name}" is empty.`);
        // The ZIP name counts as the outer folder, so "<Product title>.zip" with 1.jpg, 2.jpg inside works.
        const prefix = `${file.name.replace(/\.zip$/i, "")}/`;
        for (const entry of entries) sources.push({ path: `${prefix}${entry.path}`, size: entry.size, load: entry.blob, head: entry.head });
      }
      setBusy(false);
      await prepare(sources);
    } catch (problem) {
      reset();
      setBusy(false);
      setError(message(problem, "Unable to open the ZIP"));
    }
  }

  async function uploadRow(row: Row) {
    const id = row.product.id;
    const set = (patch: Partial<Progress>) =>
      setProgress((current) => ({ ...current, [id]: { ...(current[id] || { state: "ready", done: 0, total: row.images.length, message: "" }), ...patch } }));
    set({ state: "uploading", done: 0, total: row.images.length, message: "" });
    const urls: string[] = new Array(row.images.length);
    let done = 0;
    let next = 0;
    // 3-4 images at once; each failed image is retried once. Any image that still fails
    // stops this product (nothing is saved for it) but not the others.
    const worker = async () => {
      while (next < row.images.length) {
        const index = next++;
        const file = row.images[index];
        const name = file.path.split("/").pop() || "image";
        urls[index] = await withRetry(async () => uploadAdminImage(await file.load(), name));
        done += 1;
        set({ done });
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, row.images.length) }, worker));
      // Same image = same SHA-256 file name = same URL: skip it on this product.
      const existing = new Set(row.product.rawImages || []);
      const fresh = [...new Set(urls)].filter((url) => !existing.has(url));
      const duplicates = urls.length - fresh.length;
      const room = Math.max(0, MAX_PRODUCT_IMAGES - existing.size);
      const added = Math.min(fresh.length, room);
      if (fresh.length) {
        const mainIsNew = row.hasFeatured && fresh[0] === urls[0];
        await clientApi(
          `/api/admin/products/${id}/images`,
          { method: "POST", body: JSON.stringify({ images: fresh.slice(0, room), mode: "append", featuredFirst: mainIsNew }) },
          true,
        );
      }
      const parts = [`${added} image${added === 1 ? "" : "s"} added`];
      if (duplicates) parts.push(`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`);
      if (fresh.length > added) parts.push(`${fresh.length - added} over the ${MAX_PRODUCT_IMAGES}-image limit`);
      set({ state: "done", message: parts.join(", ") });
      return { added, duplicates, ok: true };
    } catch (problem) {
      set({ state: "error", message: `${message(problem, "Upload failed")} Nothing was saved for this product.` });
      return { added: 0, duplicates: 0, ok: false };
    }
  }

  async function confirmUpload() {
    if (busy || !waiting.length) return;
    setBusy(true);
    setError("");
    setNote("");
    let added = 0;
    let duplicates = 0;
    let failed = 0;
    let saved = 0;
    for (const row of waiting) {
      const result = await uploadRow(row);
      added += result.added;
      duplicates += result.duplicates;
      if (result.ok) saved += 1;
      else failed += 1;
    }
    setNote(`${added} image${added === 1 ? "" : "s"} added to ${saved} product${saved === 1 ? "" : "s"}${duplicates ? `, ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}.`);
    if (failed) setError(`${failed} product${failed === 1 ? "" : "s"} failed. Their images were not saved; choose those files again to retry.`);
    setBusy(false);
    onUploaded?.();
  }

  function downloadNameList() {
    const lines = ["title,slug,sku,status,currentImages"];
    for (const product of productOptions) {
      lines.push([productName(product), product.slug, product.sku, product.status, (product.rawImages || []).length].map(csvCell).join(","));
    }
    saveBlob(new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/csv" }), "zelvomart-product-names.csv");
  }

  // Products whose title is shared with another product cannot be matched by title; tell the owner.
  const sharedTitles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const key = nameKey(productName(product));
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [products]);

  return (
    <>
      <button type="button" className="admin-btn-outline" onClick={() => dialogRef.current?.showModal()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>Bulk Image Upload</span>
      </button>

      <dialog ref={dialogRef} className="admin-modal admin-modal-xl">
        <div className="admin-modal-shell">
          <div className="admin-modal-head">
            <div>
              <h2>Bulk Product Image Upload</h2>
              <p>Select an image folder or product ZIP file(s). Images are matched to product titles, slugs or SKUs; nothing is uploaded until you confirm.</p>
            </div>
            <button type="button" className="admin-modal-close" onClick={() => dialogRef.current?.close()}>×</button>
          </div>
          <div className="admin-modal-body">
            <div className="admin-bulk-help">
              <b>Naming examples</b>
              <p>
                Product: <b>HP EliteBook 840 G8 Laptop</b> → images can be named <b>HP EliteBook 840 G8 Laptop.jpg</b>, <b>HP EliteBook 840 G8 Laptop-1.jpg</b>,{" "}
                <b>HP EliteBook 840 G8 Laptop-front.webp</b>.
              </p>
              <p>
                ZIP option: name the ZIP exactly like the product, for example <b>HP EliteBook 840 G8 Laptop.zip</b>, with <b>1.jpg, 2.jpg, 3.webp</b> inside. Or one ZIP
                with a folder per product named like the product. A SKU or slug as the name also works.
              </p>
              <p>
                Numbered files: <b>1</b> is the main image, then 2, 3… Without numbers, the first file in name order is the main image. No sub-folders: a variable product&apos;s
                images belong to the product and show for every variation.
              </p>
              <p>
                The system never guesses: a name that matches no product or more than one stays unassigned for you to pick. Images are converted to WEBP (longest side 1200 px) before
                upload. Existing images are kept; each product is capped at {MAX_PRODUCT_IMAGES} images. The same image uploaded again is skipped as a duplicate.
              </p>
              <button type="button" className="admin-import-alt" disabled={!products.length} onClick={downloadNameList}>
                Download product names CSV
              </button>
            </div>

            <div className="admin-bulk-inputs">
              <label className="admin-bulk-input">
                <span>Image folder</span>
                <span className="admin-bulk-file">
                  <span className="admin-btn admin-btn-light">Choose folder</span>
                  <em>{folderLabel}</em>
                </span>
                <input hidden type="file" multiple disabled={busy} onChange={onFolder} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
                <small>Use product names in image filenames, or one sub-folder per product.</small>
              </label>
              <label className="admin-bulk-input">
                <span>Product ZIP file(s)</span>
                <span className="admin-bulk-file">
                  <span className="admin-btn admin-btn-light">Choose files</span>
                  <em>{zipLabel}</em>
                </span>
                <input hidden type="file" multiple disabled={busy} accept=".zip,application/zip,application/x-zip-compressed" onChange={onZips} />
                <small>ZIP name = product name; inside, images may be 1, 2, 3, 4.</small>
              </label>
            </div>
            <p className="admin-bulk-formats">JPG, JPEG, PNG, WEBP or GIF. Converted to WEBP in the browser; maximum 4 MB per image after conversion. GIFs upload as they are.</p>

            {busy && !match ? <div className="admin-import-message">Reading the files and matching them to products…</div> : null}
            {error ? <div className="admin-import-message error">{error}</div> : null}
            {note ? <div className="admin-import-message success">{note}</div> : null}

            {match ? (
              <>
                <div className="admin-import-summary">
                  <b>
                    {rows.length} product{rows.length === 1 ? "" : "s"} matched · {rows.reduce((sum, row) => sum + row.images.length, 0)} image
                    {rows.reduce((sum, row) => sum + row.images.length, 0) === 1 ? "" : "s"}
                  </b>
                  <span>
                    {unassignedLeft} unassigned · {match.skipped.length} skipped
                  </span>
                </div>
                {rows.length ? (
                  <div className="admin-table-wrap admin-import-preview">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>File or folder</th>
                          <th>Matched product</th>
                          <th>Images</th>
                          <th>Main image</th>
                          <th>Alt text</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const state = progress[row.product.id] || { state: "ready", done: 0, total: row.images.length, message: "" };
                          const existing = (row.product.rawImages || []).length;
                          const keepsMain = existing > 0 && !row.hasFeatured;
                          const over = existing + row.images.length - MAX_PRODUCT_IMAGES;
                          return (
                            <tr key={row.product.id}>
                              <td>
                                {row.sources.slice(0, 3).map((source) => (
                                  <small key={source} className="admin-import-sub">{source}</small>
                                ))}
                                {row.sources.length > 3 ? <small className="admin-import-sub">+{row.sources.length - 3} more</small> : null}
                                {row.byHand ? <small className="admin-import-sub warning">{row.byHand} picked by hand</small> : null}
                              </td>
                              <td>
                                <div className="admin-bulk-product">
                                  {row.product.image ? <img className="admin-bulk-thumb" src={row.product.image} alt="" /> : <span className="admin-bulk-thumb empty" />}
                                  <div>
                                    <b>{productName(row.product)}</b>
                                    <small className="admin-import-sub">{row.product.sku}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {row.images.length} new
                                <small className="admin-import-sub">{existing} already on product</small>
                                {over > 0 ? <small className="admin-import-sub warning">{over} over the {MAX_PRODUCT_IMAGES}-image limit will be left out</small> : null}
                              </td>
                              <td>
                                <div className="admin-bulk-product">
                                  <LocalThumb file={row.images[0]} />
                                  <small className="admin-import-sub">
                                    {row.images[0].path.split("/").pop()}
                                    {keepsMain ? " (added after the current main image)" : ""}
                                  </small>
                                </div>
                              </td>
                              <td>
                                {row.product.imageAlt ? <small className="admin-import-sub">{row.product.imageAlt}</small> : <small className="admin-import-sub warning">None: the title is used</small>}
                                {sharedTitles.get(nameKey(productName(row.product)))! > 1 ? <small className="admin-import-sub warning">Another product has the same title</small> : null}
                              </td>
                              <td>
                                <span className={`admin-import-state ${state.state === "done" ? "posted" : state.state === "uploading" ? "saving" : state.state}`}>
                                  {state.state === "ready" ? "Ready" : state.state === "uploading" ? `${state.done}/${state.total}` : state.state === "done" ? "Done" : "Failed"}
                                </span>
                                {state.state === "uploading" || state.state === "done" ? (
                                  <span className="admin-bulk-progress">
                                    <span style={{ width: `${state.total ? Math.round((state.done / state.total) * 100) : 0}%` }} />
                                  </span>
                                ) : null}
                                {state.message ? <small className={`admin-import-sub${state.state === "error" ? " error" : ""}`}>{state.message}</small> : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {match.unassigned.length ? (
                  <div className="admin-bulk-section">
                    <h3>Unassigned ({unassignedLeft})</h3>
                    <p>These files were not matched to exactly one product. Pick the product by hand, or leave them unassigned to skip them.</p>
                    <div className="admin-table-wrap admin-import-preview">
                      <table className="admin-table">
                        <tbody>
                          {match.unassigned.map((item) => (
                            <tr key={item.file.path}>
                              <td>
                                <LocalThumb file={item.file} />
                              </td>
                              <td>
                                <b>{item.file.path.split("/").pop()}</b>
                                <small className="admin-import-sub">{item.file.path}</small>
                                <small className="admin-import-sub warning">{item.reason}</small>
                              </td>
                              <td>
                                <select
                                  className={`admin-import-category${picks[item.file.path] ? "" : " missing"}`}
                                  value={picks[item.file.path] || ""}
                                  disabled={busy || Boolean(picks[item.file.path] && progress[picks[item.file.path]] && progress[picks[item.file.path]].state !== "ready")}
                                  onChange={(event) => setPicks((current) => ({ ...current, [item.file.path]: event.target.value }))}
                                >
                                  <option value="">Leave unassigned</option>
                                  {item.candidates.length ? (
                                    <optgroup label="Possible matches">
                                      {item.candidates.map((product) => (
                                        <option key={product.id} value={product.id}>
                                          {productName(product)} ({product.sku})
                                        </option>
                                      ))}
                                    </optgroup>
                                  ) : null}
                                  <optgroup label="All products">
                                    {productOptions.map((product) => (
                                      <option key={product.id} value={product.id}>
                                        {productName(product)} ({product.sku})
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {match.skipped.length ? (
                  <div className="admin-import-message warning">
                    {match.skipped.length} file{match.skipped.length === 1 ? " was" : "s were"} skipped:
                    <ul className="admin-import-problems">
                      {match.skipped.slice(0, 40).map((item) => (
                        <li key={item.path}>
                          <b>{item.path}</b>
                          {item.reason}
                        </li>
                      ))}
                      {match.skipped.length > 40 ? <li>…and {match.skipped.length - 40} more.</li> : null}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="admin-modal-footer-actions">
              <button type="button" className="admin-btn admin-btn-light" onClick={() => dialogRef.current?.close()}>
                Close
              </button>
              <button type="button" className="admin-btn admin-btn-primary" disabled={!waiting.length || busy} onClick={confirmUpload}>
                {busy && match
                  ? "Uploading…"
                  : `Confirm and upload${waitingImages ? ` ${waitingImages} image${waitingImages === 1 ? "" : "s"} to ${waiting.length} product${waiting.length === 1 ? "" : "s"}` : ""}`}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

