"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { adminFetch, clientApi } from "@/lib/client-api";

type ProductLike = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  sku?: string;
  rawImages?: string[];
  images?: Array<{ src?: string }> | string[];
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
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
  return rows.filter((r) => r.some((value) => value.trim()));
}

function toObjects(rows: string[][]) {
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one product row.");
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row, index) => ({
    row: index + 2,
    data: Object.fromEntries(headers.map((header, i) => [header, String(row[i] ?? "").trim()])),
  }));
}

async function download(path: string, name: string) {
  const response = await adminFetch(path);
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalized(value?: string) {
  return String(value || "").toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "");
}

function existingImages(product: ProductLike) {
  if (Array.isArray(product.rawImages)) return product.rawImages.filter(Boolean);
  if (!Array.isArray(product.images)) return [];
  return product.images
    .map((image) => (typeof image === "string" ? image : image?.src || ""))
    .filter(Boolean);
}

function matchProduct(file: File, products: ProductLike[]) {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const parts = relative.split("/").filter(Boolean);
  const folderCandidate = parts.length > 1 ? parts[parts.length - 2] : "";
  const fileCandidate = file.name.replace(/\.[^.]+$/, "").replace(/[-_ ]?(?:image|img)?[-_ ]?\d+$/i, "");
  const candidates = [normalized(folderCandidate), normalized(fileCandidate)].filter(Boolean);

  const ranked = products
    .map((product) => ({
      product,
      keys: [normalized(product.sku), normalized(product.slug), normalized(product.title || product.name)].filter(Boolean),
    }))
    .map((entry) => ({
      ...entry,
      score: Math.max(
        0,
        ...entry.keys.flatMap((key) =>
          candidates.map((candidate) => {
            if (!key || !candidate) return 0;
            if (candidate === key) return 1000 + key.length;
            if (candidate.startsWith(key) || key.startsWith(candidate)) return 500 + Math.min(key.length, candidate.length);
            return 0;
          }),
        ),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score > 0 ? ranked[0].product : null;
}

export default function ProductAdminTools({
  onImported,
  products = [],
  compact = false,
}: {
  onImported?: () => void;
  products?: ProductLike[];
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fileName, setFileName] = useState("");
  const [items, setItems] = useState<Array<{ row: number; data: Record<string, string> }>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderResult, setFolderResult] = useState("");
  const preview = useMemo(() => items.slice(0, 6), [items]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setItems([]);
    setError("");
    setResult("");
    setFileName(file?.name || "");
    if (!file) return;
    try {
      setItems(toObjects(parseCsv(await file.text())));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse CSV");
    }
  }

  async function importCsv() {
    if (!items.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await clientApi<any>(
        "/api/admin/products/import",
        { method: "POST", body: JSON.stringify({ rows: items.map((item) => item.data) }) },
        true,
      );
      setResult(`${response.created || 0} created, ${response.updated || 0} updated${response.skipped ? `, ${response.skipped} skipped` : ""}.`);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImageFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!files.length) return;
    if (!products.length) {
      setFolderResult("Products are still loading. Try again in a moment.");
      return;
    }

    setFolderBusy(true);
    setFolderResult(`Matching ${files.length} images to products...`);
    try {
      const grouped = new Map<string, { product: ProductLike; files: File[] }>();
      let unmatched = 0;
      for (const file of files) {
        const product = matchProduct(file, products);
        if (!product) {
          unmatched += 1;
          continue;
        }
        const entry = grouped.get(product.id) || { product, files: [] };
        entry.files.push(file);
        grouped.set(product.id, entry);
      }

      let updated = 0;
      let uploaded = 0;
      for (const { product, files: productFiles } of grouped.values()) {
        const urls: string[] = [];
        for (const file of productFiles.slice(0, 5)) {
          const formData = new FormData();
          formData.append("file", file);
          const response = await clientApi<{ url: string }>("/api/admin/upload", { method: "POST", body: formData }, true);
          if (response.url) {
            urls.push(response.url);
            uploaded += 1;
          }
        }
        if (!urls.length) continue;
        const merged = Array.from(new Set([...existingImages(product), ...urls])).slice(0, 5);
        await clientApi(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ images: merged }) }, true);
        updated += 1;
      }
      setFolderResult(`${uploaded} images uploaded to ${updated} products${unmatched ? ` • ${unmatched} unmatched` : ""}. Folder names should match product SKU, slug or title.`);
      onImported?.();
    } catch (err) {
      setFolderResult(err instanceof Error ? err.message : "Folder upload failed");
    } finally {
      setFolderBusy(false);
    }
  }

  return (
    <div className={`admin-product-actions${compact ? " compact" : ""}`}>
      <button type="button" className="admin-btn admin-btn-light admin-tool-btn" onClick={() => folderRef.current?.click()} disabled={folderBusy}>
        {folderBusy ? "Uploading..." : "Upload Image Folder"}
      </button>
      <input
        ref={folderRef}
        hidden
        type="file"
        accept="image/*"
        multiple
        onChange={uploadImageFolder}
        {...({ webkitdirectory: "", directory: "" } as any)}
      />
      <button type="button" className="admin-btn admin-btn-light admin-tool-btn" onClick={() => dialogRef.current?.showModal()}>
        Import CSV
      </button>
      {!compact ? (
        <>
          <button type="button" className="admin-btn admin-btn-light admin-tool-btn" onClick={() => download("/api/admin/products/template.csv", "zelvomart-products-template.csv")}>CSV Template</button>
          <button type="button" className="admin-btn admin-btn-light admin-tool-btn" onClick={() => download("/api/admin/products/export.csv", "zelvomart-products.csv")}>Export CSV</button>
        </>
      ) : null}
      {folderResult ? <span className="admin-folder-upload-result" title={folderResult}>{folderResult}</span> : null}

      <dialog ref={dialogRef} className="admin-modal admin-modal-lg">
        <div className="admin-modal-shell">
          <div className="admin-modal-head">
            <div><h2>Import Products from CSV</h2><p>Existing SKUs update; new SKUs create.</p></div>
            <button type="button" className="admin-modal-close" onClick={() => dialogRef.current?.close()}>×</button>
          </div>
          <div className="admin-modal-body">
            <div className="admin-import-drop" onClick={() => fileRef.current?.click()}>
              <span className="admin-import-symbol">CSV</span>
              <div><b>{fileName || "Choose CSV file"}</b><p>Products, prices, stock, descriptions, images and SEO fields.</p></div>
              <button type="button" className="admin-btn admin-btn-light">Browse</button>
              <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={onFile} />
            </div>
            {error ? <div className="admin-import-message error">{error}</div> : null}
            {result ? <div className="admin-import-message success">{result}</div> : null}
            {items.length ? (
              <>
                <div className="admin-import-summary"><b>{items.length} products ready</b><span>Previewing first {preview.length}</span></div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Row</th><th>Title</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead>
                    <tbody>{preview.map((item) => <tr key={item.row}><td>{item.row}</td><td>{item.data.title || item.data.name || "—"}</td><td>{item.data.sku || "—"}</td><td>{item.data.category || "—"}</td><td>{item.data.price || "—"}</td><td>{item.data.stock || "0"}</td></tr>)}</tbody>
                  </table>
                </div>
              </>
            ) : null}
            <div className="admin-modal-footer-actions">
              <button type="button" className="admin-btn admin-btn-light" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="button" className="admin-btn admin-btn-primary" disabled={!items.length || busy} onClick={importCsv}>{busy ? "Importing…" : `Import ${items.length || ""} Products`}</button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
