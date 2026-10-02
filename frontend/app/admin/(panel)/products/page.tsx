"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ProductAdminTools from "@/components/admin/ProductAdminTools";
import { useAdminData, AdminError } from "@/components/admin/useAdminData";
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

function categoryIcon(slug?: string) {
  const key = norm(slug);
  if (key.includes("beauty")) return "✦";
  if (key.includes("tech")) return "▣";
  if (key.includes("fashion")) return "◇";
  if (key.includes("sport")) return "⌁";
  if (key.includes("decor")) return "⌂";
  return "▦";
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

export default function ProductsPage() {
  const { data: products, error, reload } = useAdminData<Product[]>("/api/admin/products", []);
  const { data: categories } = useAdminData<Category[]>("/api/admin/categories", []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

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
    for (const product of products) {
      const key = product.category?.id || product.categoryId || "uncategorized";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [products]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = activeCategory === "all" || product.category?.id === activeCategory || product.categoryId === activeCategory;
      if (!categoryMatch) return false;
      if (!needle) return true;
      return `${product.title || product.name || ""} ${product.slug || ""} ${product.sku || ""} ${product.category?.name || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [products, query, activeCategory]);

  if (error) return <AdminError message={error} />;

  return (
    <>
      <div className="admin-title admin-products-title admin-products-page-title">
        <div>
          <h1>Products</h1>
          <p>Manage your Zelvomart catalog, pricing, stock, media and publishing.</p>
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
            <option value="all">All products ({products.length})</option>
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
          <ProductAdminTools products={products} onImported={reload} compact />
        </div>
      </div>

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
                const title = product.title || product.name || "Untitled product";
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
                          <b>{title}</b>
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
                        {Number(product.stock ?? product.stockQuantity ?? 0)}
                      </span>
                    </td>
                    <td>{formatAdded(product.createdAt)}</td>
                    <td>
                      <span className={`admin-publish-status ${String(product.status || "DRAFT").toLowerCase()}`}>
                        <i /> {String(product.status || "DRAFT").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <Link className="admin-row-edit-link" href={`/admin/products/${product.id}`}>Edit</Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="admin-empty">No products match this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
