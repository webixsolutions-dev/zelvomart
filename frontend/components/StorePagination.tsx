import Link from "next/link";

type QueryValue = string | number | boolean | undefined | null;

function pageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

function hrefFor(basePath: string, query: Record<string, QueryValue>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    params.set(key, String(value));
  }
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}

export default function StorePagination({
  currentPage,
  totalPages,
  basePath,
  query = {},
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, QueryValue>;
}) {
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(1, currentPage), totalPages);
  const items = pageItems(current, totalPages);
  return (
    <nav className="mock-store-pagination" aria-label="Product pages">
      {current > 1 ? <Link className="page-nav" href={hrefFor(basePath, query, current - 1)}>Previous</Link> : <span className="page-nav disabled">Previous</span>}
      <div className="page-numbers">
        {items.map((item, index) => item === "ellipsis"
          ? <span className="page-ellipsis" key={`ellipsis-${index}`}>…</span>
          : <Link key={item} className={`page-number ${item === current ? "active" : ""}`} href={hrefFor(basePath, query, item)} aria-current={item === current ? "page" : undefined}>{item}</Link>)}
      </div>
      {current < totalPages ? <Link className="page-nav" href={hrefFor(basePath, query, current + 1)}>Next</Link> : <span className="page-nav disabled">Next</span>}
    </nav>
  );
}
