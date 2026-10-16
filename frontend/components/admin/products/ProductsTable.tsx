"use client";

import { useMemo, useState } from "react";
import ProductTableRow, { Product } from "./ProductTableRow";
import ProductsPagination from "./ProductsPagination";

interface ProductsTableProps {
  products: Product[];
  emptyMessage?: string;
  onToggleStatus: (ids: string[], status: "PUBLISHED" | "DRAFT", label?: string) => void;
  onDelete: (ids: string[], label: string) => Promise<boolean>;
  posting: string[];
}

const ITEMS_PER_PAGE = 10;

export default function ProductsTable({
  products,
  emptyMessage = "No products found.",
  onToggleStatus,
  onDelete,
  posting,
}: ProductsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination calculation
  const totalItems = products.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return products.slice(start, start + ITEMS_PER_PAGE);
  }, [products, safeCurrentPage]);

  // Select all visible logic
  const allVisibleSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((p) => selectedIds.includes(p.id));

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const newIds = new Set([...selectedIds, ...paginatedProducts.map((p) => p.id)]);
      setSelectedIds(Array.from(newIds));
    } else {
      const visibleIds = new Set(paginatedProducts.map((p) => p.id));
      setSelectedIds(selectedIds.filter((id) => !visibleIds.has(id)));
    }
  }

  function handleSelectOne(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  }

  function handleBulkPublish() {
    if (!selectedIds.length) return;
    onToggleStatus(selectedIds, "PUBLISHED");
    setSelectedIds([]);
  }

  function handleBulkDraft() {
    if (!selectedIds.length) return;
    onToggleStatus(selectedIds, "DRAFT", `${selectedIds.length} products`);
    setSelectedIds([]);
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return;
    const count = selectedIds.length;
    const removed = await onDelete(selectedIds, count === 1 ? "this product" : `${count} products`);
    if (removed) setSelectedIds([]);
  }

  async function handleDeleteOne(id: string, title: string) {
    const removed = await onDelete([id], `"${title}"`);
    if (removed) setSelectedIds((current) => current.filter((item) => item !== id));
  }

  return (
    <div className="admin-table-card">
      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="admin-bulk-bar">
          <div className="admin-bulk-bar-left">
            <span>
              <b>{selectedIds.length}</b> product{selectedIds.length === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              className="text-xs text-slate-300 underline hover:text-white"
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </button>
          </div>
          <div className="admin-bulk-bar-actions">
            <button
              type="button"
              className="admin-btn-bulk-publish"
              disabled={posting.length > 0}
              onClick={handleBulkPublish}
            >
              Publish Selected
            </button>
            <button
              type="button"
              className="admin-btn-bulk-draft"
              disabled={posting.length > 0}
              onClick={handleBulkDraft}
            >
              Move to Drafts
            </button>
            <button
              type="button"
              className="admin-btn-bulk-delete"
              disabled={posting.length > 0}
              onClick={handleBulkDelete}
            >
              {posting.length ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="admin-table-container">
        <table className="admin-modern-table">
          <thead>
            <tr>
              <th style={{ width: 44, paddingLeft: 18 }}>
                <input
                  type="checkbox"
                  className="admin-custom-checkbox"
                  checked={allVisibleSelected}
                  aria-label="Select all visible products"
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th style={{ width: 72 }}>Image</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Added</th>
              <th>Status</th>
              <th style={{ textAlign: "right", paddingRight: 20 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.length > 0 ? (
              paginatedProducts.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  selected={selectedIds.includes(product.id)}
                  onSelect={handleSelectOne}
                  onToggleStatus={onToggleStatus}
                  onDelete={handleDeleteOne}
                  busy={posting.includes(product.id)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={10}>
                  <div className="admin-empty-state">
                    <div className="admin-empty-state-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
                        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
                      </svg>
                    </div>
                    <div className="admin-empty-state-title">No products found</div>
                    <div className="admin-empty-state-desc">{emptyMessage}</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <ProductsPagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={(page) => setCurrentPage(page)}
      />
    </div>
  );
}
