"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import ProductAdminTools from "@/components/admin/ProductAdminTools";
import { useAdminData, AdminError, clearAdminDataCache } from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";
import { money } from "@/lib/format";

type Category = { id: string; name: string; slug?: string; count?: number };
type Product = {
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

const PRIMARY_CATEGORY_SLUGS = [
  "home-living",
  "home-decor",
  "beauty-personal-care",
  "tech-gadgets",
  "fashion-accessories",
  "sports-fitness",
];

function norm(value?: string | null) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function addedDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAddedDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatAddedTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// "Today", "Yesterday", then the full date for anything older
function dayLabel(date: Date | null) {
  if (!date) return "Date not recorded";
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function productStatus(product: Product) {
  return String(product.status || "DRAFT").toUpperCase();
}

type ProductsAdminListProps = {
  mode: "catalog" | "drafts";
  title: string;
  description: string;
  emptyMessage: string;
};

export default function ProductsAdminList({ mode, title, description, emptyMessage }: ProductsAdminListProps) {
  const { data: products, error, reload } = useAdminData<Product[]>("/api/admin/products", []);
  const { data: categories } = useAdminData<Category[]>("/api/admin/categories", []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [posting, setPosting] = useState<string[]>([]);
  const [postMessage, setPostMessage] = useState("");

  async function setProductStatus(ids: string[], status: "PUBLISHED" | "DRAFT", label = "") {
    if (!ids.length || posting.length) return;
    if (status === "PUBLISHED" && ids.length > 1 && !confirm(`Post ${ids.length} draft products to the shop?`)) return;
    if (status === "DRAFT" && !confirm(`Move ${label || "this product"} to drafts? It will be hidden from the shop until you publish it again.`)) return;
    setPosting(ids);
    setPostMessage("");
    try {
      const response = await clientApi<{ updated: string[]; failed: { title: string; error: string }[] }>(
        "/api/admin/products/bulk-status",
        { method: "POST", body: JSON.stringify({ ids, status }) },
        true,
      );
      const done = status === "PUBLISHED" ? "posted" : "moved to drafts";
      const failed = response.failed.map((entry) => `${entry.title}: ${entry.error}`).join(" ");
      setPostMessage(`${response.updated.length} ${done}.${failed ? ` Not changed — ${failed}` : ""}`);
      clearAdminDataCache("/api/admin/products");
      await reload();
    } catch (requestError) {
      setPostMessage(requestError instanceof Error ? requestError.message.replace(/_/g, " ") : "Update failed");
    } finally {
      setPosting([]);
    }
  }

  const scopedProducts = useMemo(() => {
    // Newest first, so today's products lead the list, then yesterday's
    const added = (product: Product) => addedDate(product.createdAt)?.getTime() ?? 0;
    return products
      .filter((product) => mode !== "drafts" || productStatus(product) === "DRAFT")
      .sort((a, b) => added(b) - added(a));
  }, [products, mode]);

  const primaryCategories = useMemo(() => {
    const ordered = PRIMARY_CATEGORY_SLUGS.map((slug) =>
      categories.find((category) => norm(category.slug || category.name) === slug),
    ).filter(Boolean) as Category[];
    const used = new Set(ordered.map((category) => category.id));
    const remaining = categories.filter((category) => !used.has(category.id));
    return [...ordered, ...remaining].slice(0, 6);
  }, [categories]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of scopedProducts) {
      const key = product.category?.id || product.categoryId || "uncategorized";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [scopedProducts]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scopedProducts.filter((product) => {
      const categoryMatch = activeCategory === "all" || product.category?.id === activeCategory || product.categoryId === activeCategory;
      if (!categoryMatch) return false;
      if (activeStatus !== "all" && productStatus(product) !== activeStatus) return false;
      if (!needle) return true;
      return `${product.title || product.name || ""} ${product.slug || ""} ${product.sku || ""} ${product.category?.name || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [scopedProducts, query, activeCategory, activeStatus]);

  const groups = useMemo(() => {
    const list: { label: string; items: Product[] }[] = [];
    for (const product of rows) {
      const label = dayLabel(addedDate(product.createdAt));
      const last = list[list.length - 1];
      if (last && last.label === label) last.items.push(product);
      else list.push({ label, items: [product] });
    }
    return list;
  }, [rows]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of scopedProducts) map.set(productStatus(product), (map.get(productStatus(product)) || 0) + 1);
    return map;
  }, [scopedProducts]);

  if (error) return <AdminError message={error} />;

  const listLabel = mode === "drafts" ? "All drafts" : "All products";

  return (
    <>
      <div className="admin-title admin-products-title admin-products-page-title">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      <div className="admin-products-control-row admin-products-control-row-compact">
        <label className="admin-product-search admin-product-search-wide">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, SKU or category..."
            aria-label="Search products"
          />
        </label>

        <label className="admin-category-filter">
          <span>Category</span>
          <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)} aria-label="Filter products by category">
            <option value="all">{listLabel} ({scopedProducts.length})</option>
            {primaryCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({counts.get(category.id) || 0})
              </option>
            ))}
          </select>
        </label>

        {mode === "catalog" ? (
          <label className="admin-category-filter">
            <span>Status</span>
            <select value={activeStatus} onChange={(event) => setActiveStatus(event.target.value)} aria-label="Filter products by status">
              <option value="all">All statuses ({scopedProducts.length})</option>
              <option value="PUBLISHED">Published ({statusCounts.get("PUBLISHED") || 0})</option>
              <option value="DRAFT">Draft ({statusCounts.get("DRAFT") || 0})</option>
            </select>
          </label>
        ) : null}

        <div className="admin-products-actions admin-products-actions-reference">
          <Link className="admin-btn admin-btn-primary admin-add-product-btn" href="/admin/products/add">
            + Add Product
          </Link>
          {mode === "drafts" && rows.length ? (
            <button type="button" className="admin-btn admin-btn-light admin-tool-btn" disabled={posting.length > 0} onClick={() => setProductStatus(rows.map((product) => product.id), "PUBLISHED")}>
              {posting.length > 1 ? "Posting…" : `Post all (${rows.length})`}
            </button>
          ) : null}
          <ProductAdminTools products={products} onImported={reload} compact />
        </div>
      </div>

      {postMessage ? <div className="admin-import-message success">{postMessage}</div> : null}

      <div className="admin-table-wrap admin-products-table admin-products-reference-table admin-products-dated-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Added</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.map((group) => (
                <Fragment key={group.label}>
                  <tr className="admin-product-day-row">
                    <td colSpan={8}>
                      <b>{group.label}</b>
                      <span>{group.items.length} product{group.items.length === 1 ? "" : "s"} added</span>
                    </td>
                  </tr>
                  {group.items.map((product) => {
                    const titleText = product.title || product.name || "Untitled product";
                    const regular = Number(product.regularPrice ?? product.price ?? 0);
                    const sale = product.salePrice == null ? null : Number(product.salePrice);
                    const current = sale && sale > 0 && sale < regular ? sale : Number(product.price ?? regular);
                    const image = product.image || product.rawImages?.[0];
                    const status = productStatus(product);
                    const inStock = Number(product.stock ?? product.stockQuantity ?? 0) > 0;
                    const added = addedDate(product.createdAt);
                    const busy = posting.includes(product.id);
                    return (
                      <tr key={product.id} className="admin-product-table-row">
                        <td data-label="Item">
                          <Link className="admin-product-cell admin-product-cell-link" href={`/admin/products/${product.id}`}>
                            {image ? (
                              <img src={image} alt="" loading="lazy" />
                            ) : (
                              <span className="admin-product-thumb-placeholder">IMG</span>
                            )}
                            <div>
                              <b>{titleText}</b>
                              <small>{product.slug || "No slug"}</small>
                            </div>
                          </Link>
                        </td>
                        <td data-label="Category">{product.category?.name || "Uncategorized"}</td>
                        <td data-label="SKU"><span className="admin-product-sku">{product.sku || "—"}</span></td>
                        <td data-label="Price">
                          <div className="admin-product-price-cell">
                            <strong>{money(current)}</strong>
                            {sale && sale < regular ? <del>{money(regular)}</del> : null}
                          </div>
                        </td>
                        <td data-label="Stock">
                          <span className={`admin-stock-pill ${inStock ? "in" : "out"}`}>{inStock ? "In stock" : "Out of stock"}</span>
                        </td>
                        <td data-label="Added">
                          {added ? (
                            <time className="admin-product-added" dateTime={added.toISOString()}>
                              <b>{formatAddedTime(added)}</b>
                              <span>{formatAddedDate(added)}</span>
                            </time>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td data-label="Status">
                          <span className={`admin-publish-status ${status.toLowerCase()}`}>
                            <i /> {status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td data-label="Actions">
                          <div className="admin-import-row-actions">
                            {status === "PUBLISHED" ? (
                              <button type="button" className="admin-btn admin-btn-light" disabled={posting.length > 0} onClick={() => setProductStatus([product.id], "DRAFT", `"${titleText}"`)}>
                                {busy ? "Moving…" : "Draft"}
                              </button>
                            ) : (
                              <button type="button" className="admin-btn admin-btn-primary" disabled={posting.length > 0} onClick={() => setProductStatus([product.id], "PUBLISHED")}>
                                {busy ? "Publishing…" : "Publish"}
                              </button>
                            )}
                            <Link className="admin-btn admin-btn-light" href={`/admin/products/${product.id}`}>Edit</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="admin-empty">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
