/**
 * Star line used on product cards and the product page.
 * No reviews yet: five yellow stars and "(0)". The `stars-empty` class on that state
 * is the one switch for showing grey outline stars later (see globals.css).
 */
function StarIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
    </svg>
  );
}

export function Stars({
  rating = 0,
  count = 0,
  size = 14,
  showAverage = true,
  bare = false,
  className = "",
}: {
  rating?: number;
  count?: number;
  size?: number;
  showAverage?: boolean;
  /** Stars only, no "(count)" text — for a single review's rating. */
  bare?: boolean;
  className?: string;
}) {
  const empty = !count;
  const value = empty ? 5 : Math.max(0, Math.min(5, rating));
  const label = bare
    ? `Rated ${value} out of 5`
    : empty ? "No reviews yet" : `Rated ${value.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`;
  return (
    <span className={`stars ${empty ? "stars-empty" : ""} ${className}`} role="img" aria-label={label}>
      <span className="stars-icons" style={{ "--star-fill": `${(value / 5) * 100}%` } as React.CSSProperties}>
        <span className="stars-base">
          {[0, 1, 2, 3, 4].map((i) => (
            <StarIcon key={i} size={size} />
          ))}
        </span>
        <span className="stars-fill">
          {[0, 1, 2, 3, 4].map((i) => (
            <StarIcon key={i} size={size} />
          ))}
        </span>
      </span>
      {!bare && (
      <span className="stars-text" aria-hidden="true">
        {!empty && showAverage && <strong>{value.toFixed(1)}</strong>} ({count})
      </span>
      )}
    </span>
  );
}
