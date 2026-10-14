"use client";

import Link from "next/link";
import { money } from "@/lib/format";
import StockBadge from "./StockBadge";
import ProductStatusBadge from "./ProductStatusBadge";
import ProductMoreMenu from "./ProductMoreMenu";

type Category = { id: string; name: string; slug?: string; count?: number };
export type Product = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  sku?: string;
  image?: string;
  rawImages?: string[];
  categoryId?: string | null;
  category?: Category | null;
  price?: number;
  regularPrice?: number;
  salePrice?: number | null;
  stock?: number;
  stockQuantity?: number;
  status?: string;
  createdAt?: string;
};

interface ProductTableRowProps {
  product: Product;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onToggleStatus: (ids: string[], status: "PUBLISHED" | "DRAFT", label?: string) => void;
  busy: boolean;
}

function parseDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatAddedDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatAddedTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function getCategoryVariant(catName?: string) {
  const norm = String(catName || "").toLowerCase();
  if (norm.includes("fashion") || norm.includes("accessori") || norm.includes("cloth")) return "fashion";
  if (norm.includes("beauty") || norm.includes("care") || norm.includes("cosmetic")) return "beauty";
  if (norm.includes("home") || norm.includes("decor") || norm.includes("living")) return "home";
  if (norm.includes("tech") || norm.includes("gadget") || norm.includes("electron")) return "tech";
  if (norm.includes("sport") || norm.includes("fitness")) return "sports";
  return "default";
}

export default function ProductTableRow({
  product,
  selected,
  onSelect,
  onToggleStatus,
  busy,
}: ProductTableRowProps) {
  const titleText = product.title || product.name || "Untitled product";
  const regular = Number(product.regularPrice ?? product.price ?? 0);
  const sale = product.salePrice == null ? null : Number(product.salePrice);
  const current = sale && sale > 0 && sale < regular ? sale : Number(product.price ?? regular);
  const image = product.image || product.rawImages?.[0];
  const status = String(product.status || "DRAFT").toUpperCase();
  const isPublished = status === "PUBLISHED";
  const added = parseDate(product.createdAt);
  const categoryName = product.category?.name || "Uncategorized";
  const categoryVariant = getCategoryVariant(categoryName);

  let finalImage = image;
  if (!finalImage) {
    const lower = titleText.toLowerCase();
    if (lower.includes("shirt") || lower.includes("tee")) {
      finalImage = "/images/admin/sample-white-tshirt.png";
    } else if (lower.includes("lipstick") || lower.includes("lipstic")) {
      finalImage = "/images/admin/sample-matte-lipstick.png";
    }
  }

  return (
    <tr className="admin-product-row">
      <td style={{ width: 44, paddingLeft: 18 }}>
        <input
          type="checkbox"
          className="admin-custom-checkbox"
          checked={selected}
          aria-label={`Select ${titleText}`}
          onChange={(e) => onSelect(product.id, e.target.checked)}
        />
      </td>

      <td style={{ width: 72 }}>
        <Link href={`/admin/products/${product.id}`} className="block">
          {finalImage ? (
            <img src={finalImage} alt={titleText} className="admin-product-thumb" loading="lazy" />
          ) : (
            <div className="admin-product-thumb-placeholder">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </Link>
      </td>

      <td>
        <div className="admin-product-info-cell">
          <Link href={`/admin/products/${product.id}`} className="admin-product-title-link">
            {titleText}
          </Link>
          <span className="admin-product-subtitle">{product.slug || "No slug"}</span>
        </div>
      </td>

      <td>
        <span className={`admin-category-pill ${categoryVariant}`}>{categoryName}</span>
      </td>

      <td>
        <span className="admin-sku-text">{product.sku || "—"}</span>
      </td>

      <td>
        <div className="admin-price-cell">
          <span className="admin-price-current">{money(current)}</span>
          {sale && sale < regular ? (
            <span className="admin-price-original">{money(regular)}</span>
          ) : null}
        </div>
      </td>

      <td>
        <StockBadge stock={product.stock} stockQuantity={product.stockQuantity} />
      </td>

      <td>
        {added ? (
          <div className="admin-added-cell">
            <span className="admin-added-date">{formatAddedDate(added)}</span>
            <span className="admin-added-time">{formatAddedTime(added)}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )}
      </td>

      <td>
        <ProductStatusBadge status={status} />
      </td>

      <td>
        <div className="admin-actions-cell">
          {isPublished ? (
            <button
              type="button"
              className="admin-btn-draft"
              disabled={busy}
              onClick={() => onToggleStatus([product.id], "DRAFT", `"${titleText}"`)}
            >
              {busy ? "Moving…" : "Draft"}
            </button>
          ) : (
            <button
              type="button"
              className="admin-btn-publish"
              disabled={busy}
              onClick={() => onToggleStatus([product.id], "PUBLISHED")}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}

          <ProductMoreMenu
            productId={product.id}
            slug={product.slug}
            status={status}
            productTitle={titleText}
            onToggleStatus={onToggleStatus}
            disabled={busy}
          />
        </div>
      </td>
    </tr>
  );
}
