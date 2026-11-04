import { removeVisit } from "@/lib/atlas/actions";
import { countryName } from "@/lib/atlas/countries";
import type { Visit } from "@/lib/atlas/queries";

type Group = { code: string; name: string; visits: Visit[] };

export function groupByCountry(visits: readonly Visit[]): Group[] {
  const groups = new Map<string, Group>();
  for (const visit of visits) {
    const group = groups.get(visit.country_code) ?? {
      code: visit.country_code,
      name: countryName(visit.country_code),
      visits: [],
    };
    group.visits.push(visit);
    groups.set(visit.country_code, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** Places grouped by country. The owner can remove any entry; visitors see a read-only list. */
export function VisitList({ visits, editable }: { visits: readonly Visit[]; editable: boolean }) {
  const groups = groupByCountry(visits);
  return (
    <ul className="flex flex-col">
      {groups.map((group) => (
        <li key={group.code} className="border-t border-rule py-3 first:border-t-0">
          <h3 className="text-ui font-semibold">{group.name}</h3>
          <ul className="flex flex-col">
            {group.visits.map((visit) => {
              const label = visit.city ? visit.city.name : "The whole country";
              return (
                <li key={visit.id} className="flex min-h-10 items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-ui">{label}</span>
                    {visit.city?.region && visit.city.region !== visit.city.name ? (
                      <span className="truncate text-meta text-muted">{visit.city.region}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-meta text-muted tabular-nums">
                      {visit.visited_year ?? "—"}
                    </span>
                    {editable ? (
                      <form action={removeVisit}>
                        <input type="hidden" name="id" value={visit.id} />
                        <button
                          type="submit"
                          aria-label={`Remove ${label}, ${group.name}`}
                          className="pressable min-h-9 text-meta text-muted underline-offset-4 hover:text-negative hover:underline"
                        >
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
