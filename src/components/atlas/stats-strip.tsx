import { continentName } from "@/lib/atlas/countries";
import type { AtlasStats } from "@/lib/atlas/stats";

/** The three counts as one divided strip: type, not tiles. */
export function StatsStrip({ stats }: { stats: AtlasStats }) {
  const items = [
    { label: "Countries", value: stats.countries },
    { label: "Cities", value: stats.cities },
    {
      label: "Continents",
      value: stats.continents.length,
      detail: stats.continents.map(continentName).join(", "),
    },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-rule rounded-card border border-border bg-panel">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 px-4 py-3">
          <dt className="text-meta text-muted">{item.label}</dt>
          <dd className="text-title font-semibold tabular-nums">{item.value}</dd>
          {item.detail ? (
            <dd className="hidden truncate text-meta text-muted sm:block">{item.detail}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
