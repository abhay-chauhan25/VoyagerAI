import Link from "next/link";

export type DriftView = "for-you" | "ask" | "saved";

const VIEWS: { view: DriftView; label: string }[] = [
  { view: "for-you", label: "For you" },
  { view: "ask", label: "Ask Compass" },
  { view: "saved", label: "Saved" },
];

export function DriftTabs({ current, savedCount }: { current: DriftView; savedCount: number }) {
  return (
    <nav
      aria-label="Drift"
      className="flex gap-1 self-start rounded-control bg-raised p-0.5 text-ui"
    >
      {VIEWS.map(({ view, label }) => (
        <Link
          key={view}
          href={view === "for-you" ? "/drift" : `/drift?view=${view}`}
          aria-current={current === view ? "page" : undefined}
          className={`pressable flex min-h-9 items-center rounded-[3px] px-3 ${
            current === view ? "bg-panel font-semibold text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {label}
          {view === "saved" && savedCount > 0 ? (
            <span className="ml-1.5 text-meta text-muted tabular-nums">{savedCount}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Says plainly who picked the cards and how much AI is left today. */
export function DeckStatus({
  source,
  callsLeft,
}: {
  source: "compass" | "fallback";
  callsLeft: number;
}) {
  return (
    <p role="status" className="text-meta text-muted">
      {source === "compass"
        ? "Picked by Compass for your Travel DNA."
        : "Chosen without AI: Compass was unavailable or today's requests are used up."}{" "}
      {callsLeft} Compass {callsLeft === 1 ? "request" : "requests"} left today.
    </p>
  );
}

/** Deck-shaped placeholder while Compass works; same size as the deck, no shimmer. */
export function DeckSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-6" aria-busy="true">
      <p role="status" className="text-ui text-muted">
        {label}
      </p>
      <div className="aspect-[3/4.4] w-full max-w-[24rem] rounded-card bg-raised" />
      <div className="grid w-full max-w-[24rem] grid-cols-3 gap-2">
        <div className="h-12 rounded-control bg-raised" />
        <div className="h-12 rounded-control bg-raised" />
        <div className="h-12 rounded-control bg-raised" />
      </div>
    </div>
  );
}
