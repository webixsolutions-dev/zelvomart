"use client";

interface ProductStatsProps {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export default function ProductStats({
  total,
  inStock,
  lowStock,
  outOfStock,
}: ProductStatsProps) {
  return (
    <div className="admin-products-stats-row">
      {/* Total Products */}
      <div className="admin-stat-pill-card">
        <div className="admin-stat-pill-icon blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
            <path d="m4 7.5 8 4.5 8-4.5" />
            <path d="M12 12v9" />
          </svg>
        </div>
        <div className="admin-stat-pill-content">
          <span className="admin-stat-pill-label">Total Products</span>
          <strong className="admin-stat-pill-value">{total}</strong>
        </div>
      </div>

      {/* In Stock */}
      <div className="admin-stat-pill-card">
        <span className="admin-stat-dot green" aria-hidden="true" />
        <div className="admin-stat-pill-content">
          <span className="admin-stat-pill-label">In Stock</span>
          <strong className="admin-stat-pill-value">{inStock}</strong>
        </div>
      </div>

      {/* Low Stock */}
      <div className="admin-stat-pill-card">
        <span className="admin-stat-dot amber" aria-hidden="true" />
        <div className="admin-stat-pill-content">
          <span className="admin-stat-pill-label">Low Stock</span>
          <strong className="admin-stat-pill-value">{lowStock}</strong>
        </div>
      </div>

      {/* Out of Stock */}
      <div className="admin-stat-pill-card">
        <span className="admin-stat-dot red" aria-hidden="true" />
        <div className="admin-stat-pill-content">
          <span className="admin-stat-pill-label">Out of Stock</span>
          <strong className="admin-stat-pill-value">{outOfStock}</strong>
        </div>
      </div>
    </div>
  );
}
