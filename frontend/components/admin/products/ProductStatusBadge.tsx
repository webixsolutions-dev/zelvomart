"use client";

interface ProductStatusBadgeProps {
  status: string;
}

export default function ProductStatusBadge({ status }: ProductStatusBadgeProps) {
  const normStatus = String(status || "DRAFT").toUpperCase();
  const isPublished = normStatus === "PUBLISHED";
  const isDraft = normStatus === "DRAFT";

  const modifierClass = isPublished
    ? "published"
    : isDraft
    ? "draft"
    : "archived";

  return (
    <span className={`admin-status-indicator ${modifierClass}`}>
      <span className="admin-badge-dot" aria-hidden="true" />
      <span>{isPublished?"Active":isDraft?"Draft":"Archived"}</span>
    </span>
  );
}
