"use client";

import Link from "next/link";
import ProductAdminTools from "@/components/admin/ProductAdminTools";
import CustomSelectDropdown, { DropdownOption } from "./CustomSelectDropdown";
import { Product } from "./ProductTableRow";

type Category = { id: string; name: string; slug?: string; count?: number };

interface ProductToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  categories: Category[];
  categoryCounts: Map<string, number>;
  activeStatus: string;
  onStatusChange: (status: string) => void;
  totalProductsCount: number;
  publishedCount: number;
  draftCount: number;
  mode: "catalog" | "drafts";
  products: Product[];
  onReload: () => void;
  onPostAllDrafts?: () => void;
  postingCount?: number;
  rowsCount?: number;
}

export default function ProductToolbar({
  query,
  onQueryChange,
  activeCategory,
  onCategoryChange,
  categories,
  categoryCounts,
  activeStatus,
  onStatusChange,
  totalProductsCount,
  publishedCount,
  draftCount,
  mode,
  products,
  onReload,
  onPostAllDrafts,
  postingCount = 0,
  rowsCount = 0,
}: ProductToolbarProps) {
  // Category dropdown options
  const categoryOptions: DropdownOption[] = [
    { id: "all", label: "All products", count: totalProductsCount },
    ...categories.map((cat) => ({
      id: cat.id,
      label: cat.name,
      count: categoryCounts.get(cat.id) || 0,
    })),
  ];

  // Status dropdown options
  const statusOptions: DropdownOption[] = [
    { id: "all", label: "All statuses", count: totalProductsCount },
    { id: "PUBLISHED", label: "Published", count: publishedCount },
    { id: "DRAFT", label: "Draft", count: draftCount },
  ];

  return (
    <div className="admin-products-toolbar">
      {/* Search & Custom Select Filters */}
      <div className="admin-products-toolbar-filters">
        {/* Search Input */}
        <div className="admin-search-box">
          <span className="admin-search-box-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            className="admin-search-box-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by product name, SKU or category..."
            aria-label="Search products"
          />
        </div>

        {/* Custom Category Dropdown */}
        <CustomSelectDropdown
          label="Category"
          value={activeCategory}
          onChange={onCategoryChange}
          options={categoryOptions}
        />

        {/* Custom Status Dropdown */}
        {mode === "catalog" && (
          <CustomSelectDropdown
            label="Status"
            value={activeStatus}
            onChange={onStatusChange}
            options={statusOptions}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="admin-products-toolbar-actions">
        <Link href="/admin/products/add" className="admin-btn-navy">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Product</span>
        </Link>

        {mode === "drafts" && rowsCount > 0 && onPostAllDrafts && (
          <button
            type="button"
            className="admin-btn-outline"
            disabled={postingCount > 0}
            onClick={onPostAllDrafts}
          >
            {postingCount > 1 ? "Posting…" : `Post all (${rowsCount})`}
          </button>
        )}

        <ProductAdminTools products={products} onImported={onReload} compact />
      </div>
    </div>
  );
}
