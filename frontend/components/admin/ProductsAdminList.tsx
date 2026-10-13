"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

function formatAdded(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const [posting, setPosting] = useState<string[]>([]);
  const [postMessage, setPostMessage] = useState("");

  async function postProducts(ids: string[]) {
    if (!ids.length || posting.length) return;
    if (ids.length > 1 && !confirm(`Post ${ids.length} draft products to the shop?`)) return;
    setPosting(ids);
    setPostMessage("");
    try {
      const response = await clientApi<{ updated: string[]; failed: { title: string; error: string }[] }>(
        "/api/admin/products/bulk-status",
        { method: "POST", body: JSON.stringify({ ids, status: "PUBLISHED" }) },
        true,
      );
      const failed = response.failed.map((entry) => `${entry.title}: ${entry.error}`).join(" ");
      setPostMessage(`${response.updated.length} posted.${failed ? ` Not posted — ${failed}` : ""}`);
      clearAdminDataCache("/api/admin/products");
      await reload();
    } catch (requestError) {
      setPostMessage(requestError instanceof Error ? requestError.message.replace(/_/g, " ") : "Posting failed");
    } finally {
      setPosting([]);
    }
  }

  const scopedProducts = useMemo(() => {
    return products.filter((product) => {
      const status = productStatus(product);
      return mode === "drafts" ? status === "DRAFT" : status !== "DRAFT";
    });
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
      if (!needle) return true;
      return `${product.title || product.name || ""} ${product.slug || ""} ${product.sku || ""} ${product.category?.name || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [scopedProducts, query, activeCategory]);

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

        <div className="admin-products-actions admin-products-actions-reference">
          <Link className="admin-btn admin-btn-primary admin-add-product-btn" href="/admin/products/add">
            + Add Product
          </Link>
          {mode === "drafts" && rows.length ? (
            <button type="button" className="admin-btn admin-btn-light admin-tool-btn" disabled={posting.length > 0} onClick={() => postProducts(rows.map((product) => product.id))}>
              {posting.length > 1 ? "Posting…" : `Post all (${rows.length})`}
            </button>
          ) : null}
          <ProductAdminTools products={products} onImported={reload} compact />
        </div>
      </div>

      {postMessage ? <div className="admin-import-message success">{postMessage}</div> : null}

      <div className="admin-table-wrap admin-products-table admin-products-reference-table">
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
            {rows.length ? (
              rows.map((product) => {
                const titleText = product.title || product.name || "Untitled product";
                const regular = Number(product.regularPrice ?? product.price ?? 0);
                const sale = product.salePrice == null ? null : Number(product.salePrice);
                const current = sale && sale > 0 && sale < regular ? sale : Number(product.price ?? regular);
                const image = product.image || product.rawImages?.[0];
                return (
                  <tr key={product.id} className="admin-product-table-row">
                    <td>
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
                    <td>{product.category?.name || "Uncategorized"}</td>
                    <td><span className="admin-product-sku">{product.sku || "—"}</span></td>
                    <td>
                      <div className="admin-product-price-cell">
                        <strong>{money(current)}</strong>
                        {sale && sale < regular ? <del>{money(regular)}</del> : null}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-stock-pill ${Number(product.stock ?? product.stockQuantity ?? 0) > 0 ? "in" : "out"}`}>
                        {Number(product.stock ?? product.stockQuantity ?? 0) > 0 ? "In stock" : "Out of stock"}
                      </span>
                    </td>
                    <td>{formatAdded(product.createdAt)}</td>
                    <td>
                      <span className={`admin-publish-status ${productStatus(product).toLowerCase()}`}>
                        <i /> {productStatus(product).replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <div className="admin-import-row-actions">
                        {productStatus(product) === "DRAFT" ? (
                          <button type="button" className="admin-btn admin-btn-primary" disabled={posting.length > 0} onClick={() => postProducts([product.id])}>
                            {posting.includes(product.id) ? "Posting…" : "Post"}
                          </button>
                        ) : null}
                        <Link className="admin-row-edit-link" href={`/admin/products/${product.id}`}>Edit</Link>
                      </div>
                    </td>
                  </tr>
                );
              })
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
