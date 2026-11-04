/**
 * Voyager's mark: a compass needle crossing a meridian — the one line every chart is drawn from.
 * Drawn on a 24-unit grid so it stays crisp at 20–32px.
 */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 1.75v20.5" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path d="M12 4.5 15 12h-6Z" fill="var(--accent)" />
      <path d="M12 19.5 9 12h6Z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark size={22} />
      <span className="font-display text-[1.375rem] leading-none font-extrabold tracking-[-0.01em] uppercase">
        Voyager
      </span>
    </span>
  );
}
