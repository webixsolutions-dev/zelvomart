"use client";

interface ProductStatusTabsProps {
  activeStatus: string;
  onChangeStatus: (status: string) => void;
  counts: {
    all: number;
    published: number;
    draft: number;
    unpublished: number;
  };
}

export default function ProductStatusTabs({
  activeStatus,
  onChangeStatus,
  counts,
}: ProductStatusTabsProps) {
  const tabs = [
    { id: "all", label: "All Products", count: counts.all },
    { id: "PUBLISHED", label: "Published", count: counts.published },
    { id: "DRAFT", label: "Draft", count: counts.draft },
    { id: "UNPUBLISHED", label: "Unpublished", count: counts.unpublished },
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
