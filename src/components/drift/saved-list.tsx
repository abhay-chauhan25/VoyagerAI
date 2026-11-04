import { removeSave } from "@/lib/drift/actions";
import type { SavedCard } from "@/lib/drift/context";
import { DriftCardRow, ExploreLink } from "./drift-card";

type Group = {
  cityId: number;
  cityName: string;
  destination: SavedCard | null;
  places: SavedCard[];
};

/** Saved cards grouped by city: the destination itself (if saved) and the places saved there. */
export function groupSaves(saves: readonly SavedCard[]): Group[] {
  const groups = new Map<number, Group>();
  for (const save of saves) {
    if (save.verdict === "pass") continue;
    const { card } = save;
    const cityName = card.kind === "destination" ? card.name : card.cityName;
    const group = groups.get(card.cityId) ?? {
      cityId: card.cityId,
      cityName,
      destination: null,
      places: [],
    };
    if (card.kind === "destination") group.destination = save;
    else group.places.push(save);
    groups.set(card.cityId, group);
  }
  return [...groups.values()];
}

function RemoveButton({ save }: { save: SavedCard }) {
  return (
    <form action={removeSave}>
      <input type="hidden" name="id" value={save.id} />
      <button
        type="submit"
        aria-label={`Remove ${save.card.name}`}
        className="pressable text-meta text-muted underline-offset-4 hover:text-negative hover:underline"
      >
        Remove
      </button>
    </form>
  );
}

export function SavedList({ saves }: { saves: readonly SavedCard[] }) {
  const groups = groupSaves(saves);
  if (groups.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-control px-5 py-6 text-ui text-muted">
        Nothing saved yet. Swipe right on a card, or ask Compass and save a suggestion.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-6">
      {groups.map((group) => (
        <li key={group.cityId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-body font-semibold">{group.cityName}</h2>
            <ExploreLink cityId={group.cityId} name={group.cityName} />
          </div>
          <ul className="flex flex-col divide-y divide-rule rounded-card border border-border bg-panel px-4">
            {group.destination ? (
              <li>
                <DriftCardRow card={group.destination.card}>
                  {group.destination.verdict === "more" ? (
                    <span className="text-meta text-accent">More like this</span>
                  ) : null}
                  <RemoveButton save={group.destination} />
                </DriftCardRow>
              </li>
            ) : null}
            {group.places.map((save) => (
              <li key={save.id}>
                <DriftCardRow card={save.card}>
                  {save.verdict === "more" ? (
                    <span className="text-meta text-accent">More like this</span>
                  ) : null}
                  <RemoveButton save={save} />
                </DriftCardRow>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
