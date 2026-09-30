"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

function parseCsv(text: string): string[][] {
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
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

function toObjects(rows: string[][]) {
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one product row.");
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row, index) => ({
    row: index + 2,
    data: Object.fromEntries(headers.map((header, i) => [header, String(row[i] ?? "").trim()])),
  }));
}

export default function ProductAdminTools() {
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fileName, setFileName] = useState("");
  const [items, setItems] = useState<Array<{ row: number; data: Record<string, string> }>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const preview = useMemo(() => items.slice(0, 6), [items]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setItems([]); setError(""); setResult(""); setFileName(file?.name || "");
    if (!file) return;
    try {
      const parsed = toObjects(parseCsv(await file.text()));
      setItems(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse CSV.");
    }
  }

  async function importCsv() {
    if (!items.length || busy) return;
    setBusy(true); setResult(""); setError("");
    try {
      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: items.map((item) => item.data) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Import failed");
      setResult(`${payload.created || 0} created, ${payload.updated || 0} updated${payload.skipped ? `, ${payload.skipped} skipped` : ""}.`);
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-product-actions">
      <button type="button" className="admin-btn admin-btn-light admin-tool-btn" onClick={() => dialogRef.current?.showModal()}>
        <span className="admin-tool-icon">⇩</span> Import CSV
      </button>
      <a className="admin-btn admin-btn-light admin-tool-btn" href="/api/admin/products/template">
        <span className="admin-tool-icon">▤</span> CSV Template
      </a>
      <a className="admin-btn admin-btn-light admin-tool-btn" href="/api/admin/products/export">
        <span className="admin-tool-icon">⇧</span> Export CSV
      </a>

      <dialog ref={dialogRef} className="admin-modal admin-modal-lg" onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
        <div className="admin-modal-shell">
          <div className="admin-modal-head">
            <div><h2>Import Products from CSV</h2><p>Upload a LaptopSouq-style product sheet. Existing SKUs are updated; new SKUs are created.</p></div>
            <button type="button" className="admin-modal-close" onClick={() => dialogRef.current?.close()}>×</button>
          </div>
          <div className="admin-modal-body">
            <div className="admin-import-drop" onClick={() => fileRef.current?.click()}>
              <span className="admin-import-symbol">CSV</span>
              <div><b>{fileName || "Choose CSV file"}</b><p>Supported columns: title, slug, sku, category, price, salePrice, costPrice, stock, status, descriptions, images, bundle and SEO fields.</p></div>
              <button type="button" className="admin-btn admin-btn-light">Browse</button>
              <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={onFile}/>
            </div>

            {error ? <div className="admin-import-message error">{error}</div> : null}
            {result ? <div className="admin-import-message success">{result}</div> : null}

            {items.length ? (
              <>
                <div className="admin-import-summary"><b>{items.length} products ready</b><span>Previewing first {preview.length}</span></div>
                <div className="admin-table-wrap admin-import-preview">
                  <table className="admin-table"><thead><tr><th>Row</th><th>Title</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead><tbody>
                    {preview.map((item) => <tr key={item.row}><td>{item.row}</td><td><b>{item.data.title || item.data.name || "—"}</b></td><td>{item.data.sku || "—"}</td><td>{item.data.category || item.data.categoryName || "—"}</td><td>{item.data.price || "—"}</td><td>{item.data.stock || "0"}</td></tr>)}
                  </tbody></table>
                </div>
              </>
            ) : null}

            <div className="admin-modal-footer-actions">
              <button type="button" className="admin-btn admin-btn-light" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="button" className="admin-btn admin-btn-primary" disabled={!items.length || busy} onClick={importCsv}>{busy ? "Importing..." : `Import ${items.length || ""} Products`}</button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
