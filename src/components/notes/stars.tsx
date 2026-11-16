const POINTS = "8,1.6 9.9,5.9 14.5,6.3 11,9.4 12.1,14 8,11.5 3.9,14 5,9.4 1.5,6.3 6.1,5.9";

/** A rating out of five, drawn; the number is read out for screen readers. */
export function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <polygon
            points={POINTS}
            fill={star <= rating ? "var(--brass)" : "none"}
            stroke={star <= rating ? "var(--brass)" : "var(--control)"}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
