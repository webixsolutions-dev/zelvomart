"use client";
import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  FolderArchive,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Download,
} from "lucide-react";
import { clientApi, adminFetch } from "@/lib/client-api";
import { uploadReviewFile } from "@/lib/review-upload";
import { Modal, Button, Select, Rating, Attachments } from "./controls";
import type { Product, Media, Batch } from "./types";
export async function download(path: string, name: string) {
  const response = await adminFetch(path);
  if (!response.ok) throw new Error("Download failed. Please retry.");
  saveBlob(await response.blob(), name);
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Row = {
  index: number;
  row: number;
  values: Record<string, string>;
  product?: Product;
  errors: string[];
  warnings: string[];
  media: Media[];
};
type Preview = { rows: Row[]; digest: string; unassigned: string[] };
export default function ImportPanel({
  products,
  onClose,
  onImported,
}: {
  products: Product[];
  onClose: () => void;
  onImported: (batch: Batch) => Promise<void>;
}) {
  const [csvFile, setCsv] = useState<File>(),
    [zip, setZip] = useState<File>(),
    [preview, setPreview] = useState<Preview>(),
    [overrides, setOverrides] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<number[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stage, setStage] = useState("");
  const cached = useRef<{ file: File; token: string; at: number } | null>(null),
    locked = useRef(false);
  async function payload() {
    if (!csvFile || csvFile.size > 2 * 1024 * 1024)
      throw new Error("Choose a CSV up to 2 MB.");
    if (
      zip &&
      (cached.current?.file !== zip ||
        Date.now() - cached.current.at > 50 * 60 * 1000)
    ) {
      setStage("Uploading media ZIP…");
      cached.current = {
        file: zip,
        token: await uploadReviewFile(zip, "zip", true),
        at: Date.now(),
      };
    }
    return {
      csvContent: new TextDecoder("utf-8", { fatal: true }).decode(
        await csvFile.arrayBuffer(),
      ),
      csvFilename: csvFile.name,
      uploadTokens: zip ? [cached.current!.token] : [],
      overrides: JSON.stringify(overrides),
    };
  }
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Please retry.");
    } finally {
      setBusy(false);
      setStage("");
      locked.current = false;
    }
  }
  async function validate() {
    const data = await payload();
    setStage("Validating rows & preparing previews…");
    const result = await clientApi<Preview>(
      "/api/admin/reviews/preview",
      { method: "POST", body: JSON.stringify(data) },
      true,
    );
    setPreview(result);
    setSelected([]);
    setConfirmed(false);
    setDirty(false);
  }
  async function commit() {
    if (!preview || dirty || !confirmed || !selected.length) return;
    const data = await payload();
    setStage(`Importing ${selected.length} reviews…`);
    const batch = await clientApi<Batch>(
      "/api/admin/reviews/import",
      {
        method: "POST",
        body: JSON.stringify({
          ...data,
          digest: preview.digest,
          selected: JSON.stringify(selected),
        }),
      },
      true,
    );
    await onImported(batch);
  }
  function exportErrors() {
    if (!preview) return;
    const cols = [
      "reviewRef",
      "productTitle",
      "productSku",
      "reviewerName",
      "reviewerEmail",
      "rating",
      "reviewText",
      "reviewDate",
      "mediaFiles",
      "avatarFile",
    ];
    const escape = (v: unknown) => `"${String(v || "").replace(/"/g, '""')}"`;
    const rows = [
      [...cols, "row", "error"],
      ...preview.rows
        .filter((r) => r.errors.length)
        .map((r) => [
          ...cols.map((k) => r.values[k]),
          r.row,
          r.errors.join(" "),
        ]),
    ];
    saveBlob(
      new Blob(
        ["\ufeff" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      "review-preview-errors.csv",
    );
  }
  const valid = preview?.rows.filter((r) => !r.errors.length) || [],
    invalid = (preview?.rows.length || 0) - valid.length;
  return (
    <Modal
      title="Import reviews"
      description="Upload once, check every row, then choose exactly what to import."
      onClose={onClose}
      wide
      busy={busy}
    >
      <div className="rw-import-body">
        <div className="rw-steps">
          <span className="is-complete">
            1 <strong>Upload files</strong>
          </span>
          <i />
          <span className={preview ? "is-complete" : ""}>
            2 <strong>Validate & preview</strong>
          </span>
          <i />
          <span>
            3 <strong>Import as Pending</strong>
          </span>
        </div>
        <div className="rw-upload-grid">
          <label className="rw-file-card">
            <FileSpreadsheet size={26} />
            <strong>
              Review CSV <em>*</em>
            </strong>
            <small>
              {csvFile?.name || "UTF-8 CSV · up to 500 rows / 2 MB"}
            </small>
            <span className="rw-file-choose">
              {csvFile ? "Change CSV" : "Choose CSV"}
            </span>
            <input
              type="file"
              aria-label="Review CSV"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                setCsv(e.target.files?.[0]);
                e.target.value = "";
                setPreview(undefined);
                setOverrides({});
              }}
            />
          </label>
          <label className="rw-file-card">
            <FolderArchive size={26} />
            <strong>
              Media ZIP <span>optional</span>
            </strong>
            <small>
              {zip?.name || "Photos, videos & avatars · up to 40 MB"}
            </small>
            <span className="rw-file-choose">
              {zip ? "Change ZIP" : "Choose ZIP"}
            </span>
            <input
              type="file"
              aria-label="Media ZIP"
              accept=".zip,application/zip"
              disabled={busy}
              onChange={(e) => {
                setZip(e.target.files?.[0]);
                e.target.value = "";
                setPreview(undefined);
              }}
            />
            {zip && (
              <button
                type="button"
                className="rw-text-button"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  setZip(undefined);
                  setPreview(undefined);
                }}
              >
                Remove ZIP
              </button>
            )}
          </label>
        </div>
        <div className="rw-import-help">
          <p>
            One row = one review. Repeat the exact product title or SKU on every
            row. Keep media inside its own <code>reviewRef/</code> folder.
          </p>
          <p>
            5 photos (JPEG, PNG, WebP, 5 MB each), 1 MP4 video (20 MB), plus an
            optional authorised avatar per review. Maximum expanded ZIP: 100 MB.
          </p>
        </div>
        <div className="rw-import-actions">
          <Button
            variant="primary"
            disabled={!csvFile || busy}
            busy={busy}
            onClick={() => void run(validate)}
          >
            <CheckCircle2 size={16} />
            {stage || (preview ? "Validate again" : "Validate & preview")}
          </Button>
          <Button
            variant="ghost"
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
        </div>
        {preview && (
          <>
            <div className="rw-preview-summary">
              <span>
                <CheckCircle2 size={17} />
                <strong>{valid.length}</strong> valid rows
              </span>
              <span className={invalid ? "has-errors" : ""}>
                <AlertCircle size={17} />
                <strong>{invalid}</strong> need attention
              </span>
              <span>
                <strong>
                  {
                    new Set(
                      preview.rows.map((r) => r.product?.id).filter(Boolean),
                    ).size
                  }
                </strong>{" "}
                products
              </span>
              <Button
                variant="ghost"
                onClick={exportErrors}
                disabled={!invalid || busy}
              >
                <Download size={15} />
                Error CSV
              </Button>
            </div>
            <div className="rw-product-counts">
              {Object.entries(
                preview.rows.reduce<Record<string, number>>((a, r) => {
                  const key = r.product?.title || "Unmatched";
                  a[key] = (a[key] || 0) + 1;
                  return a;
                }, {}),
              ).map(([title, count]) => (
                <span key={title}>
                  {title}
                  <b>{count}</b>
                </span>
              ))}
            </div>
            {preview.unassigned.length > 0 && (
              <div className="rw-callout">
                <AlertCircle size={18} />
                <p>
                  {preview.unassigned.length} unassigned files will be ignored:{" "}
                  {preview.unassigned.join(", ")}
                </p>
              </div>
            )}
            {dirty && (
              <div className="rw-callout">
                <AlertCircle size={18} />
                <p>
                  Product selections changed. Click{" "}
                  <strong>Validate again</strong> before importing.
                </p>
              </div>
            )}
            <div className="rw-preview-toolbar">
              <strong>Preview every review</strong>
              <Button
                variant="ghost"
                disabled={dirty || busy}
                onClick={() => {
                  setSelected(
                    selected.length === valid.length
                      ? []
                      : valid.map((r) => r.index),
                  );
                  setConfirmed(false);
                }}
              >
                {selected.length === valid.length && valid.length
                  ? "Deselect all"
                  : "Select all valid"}
              </Button>
            </div>
            <div className="rw-preview-table-scroll">
              <table className="rw-preview-table">
                <thead>
                  <tr>
                    <th>Include</th>
                    <th>Product match</th>
                    <th>Review</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.index}>
                      <td>
                        <label className="rw-checkbox">
                          <input
                            type="checkbox"
                            aria-label={`Include row ${r.row}`}
                            disabled={busy || dirty || !!r.errors.length}
                            checked={selected.includes(r.index)}
                            onChange={(e) => {
                              setSelected((all) =>
                                e.target.checked
                                  ? [...all, r.index]
                                  : all.filter((i) => i !== r.index),
                              );
                              setConfirmed(false);
                            }}
                          />
                          Row {r.row}
                        </label>
                      </td>
                      <td>
                        <strong>
                          {r.product?.title || "Unmatched product"}
                        </strong>
                        <small>{r.values.productSku}</small>
                        <Select
                          label={`Product for row ${r.row}`}
                          value={overrides[r.index] || ""}
                          searchable
                          disabled={busy}
                          options={[
                            { value: "", label: "Use CSV matching" },
                            ...products.map((p) => ({
                              value: p.id,
                              label: p.title,
                              detail: p.sku,
                            })),
                          ]}
                          onChange={(value) => {
                            setOverrides({ ...overrides, [r.index]: value });
                            setDirty(true);
                            setConfirmed(false);
                          }}
                        />
                      </td>
                      <td>
                        <div className="rw-inline-meta">
                          <strong>{r.values.reviewerName}</strong>
                          <span>{r.values.reviewDate}</span>
                        </div>
                        <Rating value={Number(r.values.rating)} />
                        <p>{r.values.reviewText}</p>
                        <Attachments media={r.media} />
                      </td>
                      <td>
                        {r.errors.map((v, i) => (
                          <p className="rw-field-error" key={i}>
                            {v}
                          </p>
                        ))}
                        {r.warnings.map((v, i) => (
                          <p className="rw-warning-text" key={i}>
                            {v}
                          </p>
                        ))}
                        {!r.errors.length && (
                          <span className="rw-ready">
                            <CheckCircle2 size={14} />
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="rw-checkbox rw-import-confirm">
              <input
                type="checkbox"
                disabled={dirty || busy || !selected.length}
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I confirm these{" "}
                <strong>{selected.length} selected reviews</strong> are genuine
                historical feedback and the media is authorised.
              </span>
            </label>
          </>
        )}
        {error && (
          <div className="rw-form-alert" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer className="rw-modal-footer">
        <p>Imported reviews stay Pending until you approve them.</p>
        <div>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={
              !preview || dirty || !confirmed || !selected.length || busy
            }
            busy={busy}
            onClick={() => void run(commit)}
          >
            Import {selected.length || ""} selected
            <ArrowRight size={16} />
          </Button>
        </div>
      </footer>
    </Modal>
  );
}
