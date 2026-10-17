"use client";

interface ProductsPaginationProps {
  itemLabel?: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange:(size:number)=>void;
}

export default function ProductsPagination({
  itemLabel="products",
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onPageSizeChange,
}: ProductsPaginationProps) {


  const start = totalItems ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers
  const pages: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="admin-table-footer">
      <div className="pd-footer-info">
        <label className="pd-page-size">Rows per page <select aria-label={`${itemLabel[0].toUpperCase()+itemLabel.slice(1)} per page`} value={itemsPerPage} onChange={e=>onPageSizeChange(Number(e.target.value))}>{[10,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label>
      <div className="admin-table-count-text">
        Showing <b>{start}</b> to <b>{end}</b> of <b>{totalItems}</b> {totalItems===1?itemLabel.replace(/s$/,''):itemLabel}
      </div>
      </div>

      {(
        <div className="admin-pagination-controls" aria-label="Pagination Navigation">
          <button
            type="button"
            className="admin-page-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            &lt;
          </button>

          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`admin-page-btn ${p === currentPage ? "active" : ""}`}
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            className="admin-page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
}
