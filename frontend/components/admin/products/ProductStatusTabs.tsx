"use client";

interface ProductStatusTabsProps {
  activeStatus: string;
  onChangeStatus: (status: string) => void;
  counts: {
    all: number;
    published: number;
    draft: number;
    unpublished: number;
    lowStock:number;
    outOfStock:number;
  };
}

export default function ProductStatusTabs({
  activeStatus,
  onChangeStatus,
  counts,
}: ProductStatusTabsProps) {
  const tabs = [
    { id: "all", label: "All Products", count: counts.all },
    { id: "PUBLISHED", label: "Active", count: counts.published },
    { id: "DRAFT", label: "Draft", count: counts.draft },
    { id: "LOW_STOCK", label: "Low Stock", count: counts.lowStock },
    { id: "OUT_OF_STOCK", label: "Out of Stock", count: counts.outOfStock },
    { id: "ARCHIVED", label: "Archived", count: counts.unpublished },
  ];

  return (
    <div className="admin-products-tabs-bar" role="tablist">
      {tabs.map((tab) => {
        const isActive = activeStatus === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`admin-products-tab-btn ${isActive ? "active" : ""}`}
            onClick={() => onChangeStatus(tab.id)}
          >
            <span>{tab.label}</span>
            <span className="admin-tab-count">{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}
