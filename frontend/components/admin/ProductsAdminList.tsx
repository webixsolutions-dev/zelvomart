"use client";

import { useMemo, useState } from "react";
import { useAdminData, AdminError, clearAdminDataCache } from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";
import ProductsHeader from "./products/ProductsHeader";
import ProductToolbar from "./products/ProductToolbar";
import ProductStatusTabs from "./products/ProductStatusTabs";
import ProductsTable from "./products/ProductsTable";
import { Product } from "./products/ProductTableRow";
import { stockBadgeState } from "./products/StockBadge";

type Category = { id: string; name: string; slug?: string; count?: number };

const PRIMARY_CATEGORY_SLUGS = [
  "home-living",
  "home-decor",
  "beauty-personal-care",
  "tech-gadgets",
  "fashion-accessories",
  "sports-fitness",
];

function norm(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addedDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

export default function ProductsAdminList({
  mode,
  title,
  description,
  emptyMessage,
}: ProductsAdminListProps) {
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
    if (
      status === "DRAFT" &&
      !confirm(`Move ${label || "this product"} to drafts? It will be hidden from the shop until you publish it again.`)
    )
      return;
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
    return [...ordered, ...remaining].slice(0, 10);
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
      const categoryMatch =
        activeCategory === "all" ||
        product.category?.id === activeCategory ||
        product.categoryId === activeCategory;
      if (!categoryMatch) return false;
      if (activeStatus !== "all" && productStatus(product) !== activeStatus) return false;
      if (!needle) return true;
      return `${product.title || product.name || ""} ${product.slug || ""} ${product.sku || ""} ${
        product.category?.name || ""
      }`
        .toLowerCase()
        .includes(needle);
    });
  }, [scopedProducts, query, activeCategory, activeStatus]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of scopedProducts) {
      const s = productStatus(product);
      map.set(s, (map.get(s) || 0) + 1);
    }
    return map;
  }, [scopedProducts]);

  // Real inventory metrics calculated from current scoped products
  const stats = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    for (const p of scopedProducts) {
      const state = stockBadgeState(p.stockStatus, p.stockQuantity).variant;
      if (state === "out") outOfStock += 1;
      else if (state === "low") lowStock += 1;
      else inStock += 1;
    }

    return {
      total: scopedProducts.length,
      inStock,
      lowStock,
      outOfStock,
    };
  }, [scopedProducts]);

  if (error) return <AdminError message={error} />;

  return (
    <div className="admin-products-dashboard-view">
      {/* Products Header with Title & Stats Cards */}
      <ProductsHeader
        title={title}
        description={description}
        total={stats.total}
        inStock={stats.inStock}
        lowStock={stats.lowStock}
        outOfStock={stats.outOfStock}
      />

      {/* Toolbar with Search, Category & Status Filters, and Actions */}
      <ProductToolbar
        query={query}
        onQueryChange={setQuery}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        categories={primaryCategories}
        categoryCounts={counts}
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        totalProductsCount={scopedProducts.length}
        publishedCount={statusCounts.get("PUBLISHED") || 0}
        draftCount={statusCounts.get("DRAFT") || 0}
        mode={mode}
        products={products}
        onReload={reload}
        onPostAllDrafts={() => setProductStatus(rows.map((p) => p.id), "PUBLISHED")}
        postingCount={posting.length}
        rowsCount={rows.length}
      />

      {/* Sub-tabs Filter Bar */}
      {mode === "catalog" && (
        <ProductStatusTabs
          activeStatus={activeStatus}
          onChangeStatus={setActiveStatus}
          counts={{
            all: scopedProducts.length,
            published: statusCounts.get("PUBLISHED") || 0,
            draft: statusCounts.get("DRAFT") || 0,
            unpublished: statusCounts.get("UNPUBLISHED") || statusCounts.get("ARCHIVED") || 0,
          }}
        />
      )}

      {/* Feedback Message */}
      {postMessage && (
        <div className="admin-import-message success mb-4" role="status">
          {postMessage}
        </div>
      )}

      {/* Products Table Card */}
      <ProductsTable
        products={rows}
        emptyMessage={emptyMessage}
        onToggleStatus={setProductStatus}
        posting={posting}
      />
    </div>
  );
}
