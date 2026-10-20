/** Shown at once while the next page loads, so a click never looks stuck. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-bar" aria-hidden="true" />
      <span className="page-loading-spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
