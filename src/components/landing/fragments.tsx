import Image from "next/image";
import { Avatar } from "@/components/shell/avatar";
import { DAY_ONE, DRIFT_CARD, TRAVELLERS, VOTE, dayTotals } from "./sample-trip";
import { PHOTOS } from "./photos";

/**
 * True-size fragments of the Voyager interface for the landing page. Each root carries data-ui:
 * inside a fragment the app's own conventions apply (panels, 1px rules, pills).
 */

const panel = "rounded-card border border-border bg-panel text-ink";

export function DriftCardFragment() {
  return (
    <div data-ui className={`${panel} w-full max-w-[22rem] overflow-hidden`}>
      <div className="relative aspect-[4/3]">
        <Image
          src={PHOTOS.santaLuzia}
          alt="Visitors at the Santa Luzia viewpoint above the rooftops of Alfama and the river"
          fill
          sizes="(min-width: 1024px) 22rem, 90vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lead font-semibold">{DRIFT_CARD.name}</h3>
        </div>
        <p className="text-meta text-muted">
          {DRIFT_CARD.kind} · {DRIFT_CARD.area}
        </p>
        <p className="rounded-control bg-raised px-3 py-2 text-ui">
          <span className="font-semibold">Why this: </span>
          {DRIFT_CARD.why}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <span className="flex min-h-10 items-center justify-center rounded-control border border-control text-ui">
            Pass
          </span>
          <span className="flex min-h-10 items-center justify-center rounded-control bg-primary text-ui font-semibold text-primary-ink">
            Save
          </span>
        </div>
        <p className="text-meta text-muted tabular-nums">
          Card {DRIFT_CARD.position} of {DRIFT_CARD.deckSize} · {DRIFT_CARD.saved} saved
        </p>
      </div>
    </div>
  );
}

export function DayPlanFragment() {
  const totals = dayTotals(DAY_ONE.stops);
  return (
    <div data-ui className={`${panel} w-full max-w-[26rem] p-4`}>
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <h3 className="text-body font-semibold">{DAY_ONE.label}</h3>
        <span className="text-meta text-muted">{DAY_ONE.area}</span>
      </div>
      <ol className="flex flex-col">
        {DAY_ONE.stops.map((stop) => (
          <li key={stop.name} className="border-t border-rule">
            <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-2 py-2.5">
              <span className="text-meta text-muted tabular-nums">{stop.time}</span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-ui font-semibold">{stop.name}</span>
                <span className="text-meta text-muted">{stop.kind}</span>
              </span>
              <span className="text-meta text-muted tabular-nums">{stop.stay}</span>
            </div>
            {stop.leg ? (
              <p className="pb-2 pl-[3.75rem] text-meta text-accent">
                {stop.leg.mode === "walk"
                  ? `Walk ${stop.leg.minutes} min`
                  : `${stop.leg.note ?? "Tram"}, ${stop.leg.minutes} min`}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="border-t border-rule pt-3 text-meta text-muted tabular-nums">
        {totals.stopCount} stops · {totals.walkMinutes} min on foot · {totals.tramRides} tram ride
      </p>
    </div>
  );
}

export function GroupVoteFragment() {
  const nameOf = (id: string) => TRAVELLERS.find((t) => t.id === id)?.name ?? id;
  const leader = [...VOTE.options].sort((a, b) => b.voters.length - a.voters.length)[0];

  return (
    <div data-ui className={`${panel} w-full max-w-[24rem] p-4`}>
      <div className="flex items-center justify-between gap-3 pb-3">
        <h3 className="text-body font-semibold">{VOTE.question}</h3>
        <span className="flex -space-x-1.5">
          {TRAVELLERS.map((t) => (
            <span key={t.id} className="rounded-full ring-2 ring-[var(--panel)]">
              <Avatar id={t.id} name={t.name} size={24} />
            </span>
          ))}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {VOTE.options.map((option) => {
          const winning = option === leader;
          return (
            <li
              key={option.title}
              className={`flex items-center justify-between gap-3 rounded-control border px-3 py-2.5 ${
                winning ? "border-accent" : "border-border"
              }`}
            >
              <span className="flex flex-col">
                <span className="text-ui font-semibold">{option.title}</span>
                <span className="text-meta text-muted">{option.detail}</span>
              </span>
              <span className="text-right text-meta text-muted">
                {option.voters.map(nameOf).join(", ")}
                <span className="block font-semibold text-ink tabular-nums">
                  {option.voters.length} of {TRAVELLERS.length}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {leader ? (
        <p className="pt-3 text-meta text-muted">
          <span className="font-semibold text-ink">{leader.title}</span> goes in the plan unless
          someone objects.
        </p>
      ) : null}
    </div>
  );
}
