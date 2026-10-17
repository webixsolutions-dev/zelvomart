"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminError, clearAdminDataCache } from "@/components/admin/useAdminData";
import { adminFetch, clientApi } from "@/lib/client-api";
import {ProductSummary, ProductInsights, type ProductInsightsData} from './products/ProductDashboard';
import {useOrderData} from '@/app/admin/(panel)/orders/useOrderData';
import '@/app/admin/(panel)/orders/orders.css';
import './products/product-dashboard.css';
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
  const { data: productData, loading:productsLoading, error, reload } = useOrderData<Product[]>("/api/admin/products");
  const products=useMemo(()=>productData||[],[productData]);
  const {data:insights,loading:insightsLoading,error:insightsError,reload:reloadInsights}=useOrderData<ProductInsightsData>('/api/admin/products/insights');
  const {data:categoryData,loading:categoriesLoading,reload:reloadCategories}=useOrderData<Category[]>('/api/admin/categories');
  const categories=useMemo(()=>categoryData||[],[categoryData]);
  async function refreshAll(){await Promise.all([reload(),reloadInsights(),reloadCategories()])}
  const [sort,setSort]=useState('newest');
  const [query, setQuery] = useState("");
  useEffect(() => { setQuery(new URLSearchParams(window.location.search).get("q") || ""); }, []);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [posting, setPosting] = useState<string[]>([]);
  const [postMessage, setPostMessage] = useState("");

  async function exportProducts(){
    try{const response=await adminFetch('/api/admin/products/export.csv');if(!response.ok)throw new Error('Export failed. Check your export permission.');const url=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download='zelvomart-products.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(error){setPostMessage(error instanceof Error?error.message:'Export failed')}
  }

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
      await refreshAll();
    } catch (requestError) {
      setPostMessage(requestError instanceof Error ? requestError.message.replace(/_/g, " ") : "Update failed");
    } finally {
      setPosting([]);
    }
  }

  async function deleteProducts(ids: string[], label: string) {
    if (!ids.length || posting.length) return false;
    if (
      !confirm(
        `Delete ${label}? This removes ${ids.length === 1 ? "the product" : "these products"} from the shop and the database. This cannot be undone.`,
      )
    )
      return false;
    setPosting(ids);
    setPostMessage("");
    try {
      const response = await clientApi<{ deleted: string[]; failed: { id: string; error: string }[] }>(
        "/api/admin/products/bulk-delete",
        { method: "POST", body: JSON.stringify({ ids }) },
        true,
      );
      const failed = response.failed.map((entry) => entry.error).join(" ");
      setPostMessage(
        `${response.deleted.length} deleted from the database.${failed ? ` Not deleted — ${failed}` : ""}`,
      );
      clearAdminDataCache("/api/admin/products");
      await refreshAll();
      return response.deleted.length > 0;
    } catch (requestError) {
      setPostMessage(requestError instanceof Error ? requestError.message.replace(/_/g, " ") : "Delete failed");
      return false;
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
    return [...ordered, ...remaining];
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
      if(activeStatus==='LOW_STOCK'&&stockBadgeState(product.stockStatus,product.stockQuantity).variant!=='low')return false;
      if(activeStatus==='OUT_OF_STOCK'&&stockBadgeState(product.stockStatus,product.stockQuantity).variant!=='out')return false;
      if (!['all','LOW_STOCK','OUT_OF_STOCK'].includes(activeStatus) && productStatus(product) !== activeStatus) return false;
      if (!needle) return true;
      return `${product.title || product.name || ""} ${product.slug || ""} ${product.sku || ""} ${
        product.category?.name || ""
      }`
        .toLowerCase()
        .includes(needle);
    }).map(p=>({...p,sales:insights?.sales[p.id]||0})).sort((a,b)=>sort==='highest'?Number(b.price||0)-Number(a.price||0):sort==='lowest'?Number(a.price||0)-Number(b.price||0):sort==='sales'?(b.sales||0)-(a.sales||0):sort==='title'?String(a.title||a.name).localeCompare(String(b.title||b.name)):new Date(b.updatedAt||b.createdAt||0).getTime()-new Date(a.updatedAt||a.createdAt||0).getTime());
  }, [scopedProducts, query, activeCategory, activeStatus,sort,insights]);

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
    <div className="od-dashboard pd-dashboard admin-products-dashboard-view">
      <ProductSummary title={title} description={description} products={scopedProducts} categories={categories} loading={productsLoading||categoriesLoading} onRefresh={()=>void refreshAll()}/>
      <section className="od-panel pd-table-panel">
      <div className="pd-table-heading"><h2>All Products {productsLoading?'':`(${rows.length.toLocaleString()})`}</h2><label>Sort by <select aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Recently updated</option><option value="title">Product name</option><option value="highest">Highest price</option><option value="lowest">Lowest price</option><option value="sales">Best selling</option></select></label></div>
      {/* Toolbar with Search, Category & Status Filters, and Actions */}
      <ProductToolbar
        onExport={exportProducts}
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
        onReload={refreshAll}
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
            unpublished: statusCounts.get("ARCHIVED") || 0,
            lowStock:stats.lowStock,
            outOfStock:stats.outOfStock,
          }}
        />
      )}

      {(query||activeCategory!=='all'||activeStatus!=='all'||sort!=='newest')&&<button className="pd-clear" onClick={()=>{setQuery('');setActiveCategory('all');setActiveStatus('all');setSort('newest')}}>Clear filters</button>}
      {/* Feedback Message */}
      {postMessage && (
        <div className="admin-import-message success mb-4" role="status">
          {postMessage}
        </div>
      )}

      {/* Products Table Card */}
      <ProductsTable
        key={`${query}|${activeCategory}|${activeStatus}|${sort}`}
        loading={productsLoading}
        products={rows}
        emptyMessage={emptyMessage}
        onToggleStatus={setProductStatus}
        onDelete={deleteProducts}
        posting={posting}
      />
      </section>
      <ProductInsights products={scopedProducts} categories={categories} data={insights} loading={productsLoading||categoriesLoading||insightsLoading} error={insightsError}/>
      <p className="od-footnote">Sales exclude cancelled and returned orders. Low stock follows the existing tracked-stock threshold of 5. Category performance is measured by units sold.</p>
    </div>
  );
}
