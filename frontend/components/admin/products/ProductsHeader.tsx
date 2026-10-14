"use client";

import ProductStats from "./ProductStats";

interface ProductsHeaderProps {
  title: string;
  description: string;
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export default function ProductsHeader({
  title,
  description,
  total,
  inStock,
  lowStock,
  outOfStock,
}: ProductsHeaderProps) {
  return (
    <div className="admin-products-header-container">
      {/* Title & Copy + Plant Graphic */}
      <div className="admin-products-header-left">
        <div className="admin-products-header-copy">
          <span className="admin-products-eyebrow">PRODUCTS</span>
          <h1 className="admin-products-heading">{title}</h1>
          <p className="admin-products-description">{description}</p>
        </div>

        {/* Decorative Plant in a Box Graphic matching reference design */}
        <div className="admin-products-illustration" aria-hidden="true">
          <img
            src="/images/admin/plant-in-box.png"
            alt=""
            width={110}
            height={110}
            style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }}
          />
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <ProductStats
        total={total}
        inStock={inStock}
        lowStock={lowStock}
        outOfStock={outOfStock}
      />
    </div>
  );
}
