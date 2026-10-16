"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ProductMoreMenuProps {
  productId: string;
  slug?: string;
  status: string;
  productTitle: string;
  onToggleStatus: (ids: string[], status: "PUBLISHED" | "DRAFT", label?: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function ProductMoreMenu({
  productId,
  slug,
  status,
  productTitle,
  onToggleStatus,
  onDelete,
  disabled = false,
}: ProductMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isPublished = String(status || "").toUpperCase() === "PUBLISHED";

  function handleToggle() {
    if (!open && buttonRef.current) {
      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      const tr = button.closest("tr");
      const tbody = button.closest("tbody");
      const allRows = tbody ? Array.from(tbody.querySelectorAll("tr")) : [];
      const rowIndex = tr ? allRows.indexOf(tr) : 0;
      const isLastRow = rowIndex >= allRows.length - 1 && allRows.length > 1;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Never open upwards for the first row (rowIndex === 0).
      // Only open upwards if it is explicitly the last row AND has at least 160px space above,
      // or if space below is critically tight (< 140px) AND space above is significantly larger than space below.
      const shouldOpenUp = rowIndex > 0 && (
        (isLastRow && spaceAbove > 160) ||
        (spaceBelow < 140 && spaceAbove > spaceBelow)
      );
      setOpenUpwards(shouldOpenUp);
    }
    setOpen((prev) => !prev);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="admin-btn-more"
        aria-label="More actions"
        aria-expanded={open}
        disabled={disabled}
        onClick={handleToggle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="5" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div
          className={`admin-dropdown-menu${openUpwards ? " open-upwards" : ""}`}
          style={openUpwards ? { top: "auto", bottom: "calc(100% + 6px)" } : undefined}
          role="menu"
        >
          <Link
            href={`/admin/products/${productId}`}
            className="admin-dropdown-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Edit Product</span>
          </Link>

          {slug && (
            <Link
              href={`/product/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-dropdown-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>View on Store</span>
            </Link>
          )}

          {isPublished ? (
            <button
              type="button"
              className="admin-dropdown-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onToggleStatus([productId], "DRAFT", `"${productTitle}"`);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              <span>Move to Drafts</span>
            </button>
          ) : (
            <button
              type="button"
              className="admin-dropdown-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onToggleStatus([productId], "PUBLISHED");
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Publish Product</span>
            </button>
          )}

          <button
            type="button"
            className="admin-dropdown-menu-item is-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span>Delete product</span>
          </button>
        </div>
      )}
    </div>
  );
}
