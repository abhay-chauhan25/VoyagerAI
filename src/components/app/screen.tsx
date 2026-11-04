/** Title row for an app screen: a noun title at 24px and one line saying what the screen is for. */
export function ScreenHeader({
  title,
  subline,
  action,
}: {
  title: string;
  subline: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="text-ui text-muted">{subline}</p>
      </div>
      {action}
    </div>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-8 px-4 py-6 sm:px-8 lg:py-10">
      {children}
    </div>
  );
}

/**
 * An empty section keeps its frame and header: one dashed box spanning the block, one sentence on
 * what will appear here, and (optionally) the next step.
 */
export function EmptyFrame({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section aria-label={heading} className="flex flex-col gap-3">
      <h2 className="text-body font-semibold">{heading}</h2>
      <div className="flex flex-col gap-2 rounded-card border border-dashed border-control px-5 py-6 text-ui text-muted">
        {children}
      </div>
    </section>
  );
}
