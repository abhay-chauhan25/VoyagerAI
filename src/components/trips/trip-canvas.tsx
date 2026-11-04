"use client";

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import Link from "next/link";
import { useCallback, useId, useMemo, useState, useTransition } from "react";
import { PhotoCredit } from "@/components/drift/drift-card";
import { dayHue, hueStyle } from "@/lib/hues";
import {
  addStop,
  arrangeTrip,
  optimiseDay,
  removeStop,
  setDayMode,
  updateStop,
  type TripActionResult,
} from "@/lib/trips/actions";
import { BUDGET_LABELS, PACE_LABELS } from "@/lib/dna/schemas";
import type { TravelMode } from "@/lib/trips/schemas";
import type { PriceLevel } from "@/lib/trips/stops";
import type { StopView, TripView } from "@/lib/trips/view";
import { ChangeRequests } from "./change-requests";
import { DayColumn, dayLabel } from "./day-column";
import { TripHeader } from "./trip-header";
import { TripMap, type MapDay } from "./trip-map";

type Columns = string[][];

function columnsOf(view: TripView): Columns {
  return view.days.map((d) => d.stops.map((s) => s.id));
}
const signature = (columns: Columns) => columns.map((c) => c.join(",")).join("|");

function dayOfStop(columns: Columns, id: string): number {
  return columns.findIndex((c) => c.includes(id));
}

type Props = { view: TripView; mapToken: string | undefined; callsLeft: number };

/**
 * The Trip Canvas: a day-by-day timeline beside the map. Drags show at once and are saved in the
 * background; if saving fails the timeline goes back to the saved order and says so.
 */
export function TripCanvas({ view, mapToken, callsLeft }: Props) {
  const serverColumns = useMemo(() => columnsOf(view), [view]);
  const [columns, setColumns] = useState(serverColumns);
  const [seen, setSeen] = useState(signature(serverColumns));
  // A new server layout (after saving or revalidation) replaces the local one.
  if (signature(serverColumns) !== seen) {
    setSeen(signature(serverColumns));
    setColumns(serverColumns);
  }
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [hotStop, setHotStop] = useState<string | null>(null);
  const [focusStop, setFocusStop] = useState<{ id: string; at: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, start] = useTransition();

  const stopsById = useMemo(
    () => new Map(view.days.flatMap((d) => d.stops).map((s) => [s.id, s])),
    [view],
  );
  const stale = signature(columns) !== signature(serverColumns) || pending;

  const report = useCallback((result: TripActionResult) => {
    if (!result.ok) setMessage({ text: result.message, tone: "error" });
    else if (result.message) setMessage({ text: result.message, tone: "ok" });
    else setMessage(null);
  }, []);

  const run = (action: () => Promise<TripActionResult>, revert?: () => void) =>
    start(async () => {
      const result = await action();
      if (!result.ok) revert?.();
      report(result);
    });

  const save = (next: Columns, before: Columns = columns) => {
    setColumns(next);
    run(
      () =>
        arrangeTrip({
          tripId: view.id,
          layout: next.flatMap((ids, day) => ids.map((id, position) => ({ id, day, position }))),
        }),
      () => setColumns(before),
    );
  };

  /* ---------- drag and drop ---------- */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dragStart, setDragStart] = useState<Columns | null>(null);
  // A stable id keeps dnd-kit's accessibility ids the same on the server and in the browser.
  const dndId = useId();

  const targetDay = (over: DragOverEvent["over"], cols: Columns): number => {
    if (!over) return -1;
    const id = String(over.id);
    if (id.startsWith("day-")) return Number(id.slice(4));
    return dayOfStop(cols, id);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    setColumns((cols) => {
      const from = dayOfStop(cols, String(active.id));
      const to = targetDay(over, cols);
      if (from < 0 || to < 0 || from === to) return cols;
      // Moving between days: take it out of one and put it where it hovers in the other.
      const next = cols.map((c) => c.slice());
      next[from] = next[from]!.filter((id) => id !== active.id);
      const overIndex = next[to]!.indexOf(String(over?.id));
      next[to]!.splice(overIndex >= 0 ? overIndex : next[to]!.length, 0, String(active.id));
      return next;
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const before = dragStart ?? serverColumns;
    setDragStart(null);
    let next = columns;
    const day = dayOfStop(next, String(active.id));
    if (over && day >= 0 && dayOfStop(next, String(over.id)) === day) {
      const list = next[day]!;
      const from = list.indexOf(String(active.id));
      const to = list.indexOf(String(over.id));
      if (from !== to) {
        next = next.map((c, i) => (i === day ? arrayMove(c, from, to) : c));
      }
    }
    if (signature(next) === signature(before)) {
      setColumns(before);
      return;
    }
    save(next, before);
  };

  /** What screen readers hear while a stop is dragged: names and days, never internal ids. */
  const nameOf = (id: string | number) => stopsById.get(String(id))?.name ?? "the stop";
  const whereIs = (overId: string | number) => {
    const id = String(overId);
    if (id.startsWith("day-")) return `on day ${Number(id.slice(4)) + 1}`;
    return `at ${nameOf(id)}'s place on day ${dayOfStop(columns, id) + 1}`;
  };
  const announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      // Being over its own place says nothing new (it happens right after pick-up).
      if (over?.id === active.id) return undefined;
      return over
        ? `${nameOf(active.id)} is now ${whereIs(over.id)}.`
        : `${nameOf(active.id)} is not over a day.`;
    },
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) =>
      over ? `Dropped ${nameOf(active.id)} ${whereIs(over.id)}.` : `Dropped ${nameOf(active.id)}.`,
    onDragCancel: ({ active }: { active: { id: string | number } }) =>
      `Moving ${nameOf(active.id)} was cancelled.`,
  };

  /* ---------- other edits ---------- */

  const move = (id: string, toDay: number) => {
    const next = columns.map((c) => c.filter((x) => x !== id));
    next[toDay]!.push(id);
    save(next);
  };
  const remove = (id: string) => {
    const before = columns;
    setColumns(columns.map((c) => c.filter((x) => x !== id)));
    run(
      () => removeStop({ tripId: view.id, stopId: id }),
      () => setColumns(before),
    );
  };
  const update = (
    id: string,
    fields: { priceLevel?: PriceLevel; costAmount?: number | null; dwell?: number },
  ) => run(() => updateStop({ tripId: view.id, stopId: id, ...fields }));
  const setMode = (day: number, mode: TravelMode) =>
    run(() => setDayMode({ tripId: view.id, day, mode }));
  const optimise = (day: number) => run(() => optimiseDay({ tripId: view.id, day }));
  const add = (sourceKey: string, day: number) =>
    run(() => addStop({ tripId: view.id, sourceKey, day }));

  const show = (id: string) => {
    setFocusStop({ id, at: Date.now() });
    setHotStop(id);
  };
  const pick = (id: string) => {
    setHotStop(id);
    const row = document.querySelector<HTMLElement>(`[data-stop-id="${id}"]`);
    row?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  };

  const mapDays: MapDay[] = useMemo(
    () =>
      columns.map((ids, index) => {
        const stops = ids.flatMap((id) => {
          const s = stopsById.get(id);
          return s ? [{ id, name: s.name, latitude: s.latitude, longitude: s.longitude }] : [];
        });
        const server = view.days[index];
        // The server's street path only fits if the day hasn't been rearranged since.
        const same = server && server.stops.map((s) => s.id).join(",") === ids.join(",");
        return { index, stops, line: same ? server.line : null };
      }),
    [columns, stopsById, view.days],
  );

  const credited = view.days.flatMap((d) => d.stops).filter((s) => s.photo);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-8 lg:order-1">
        <TripHeader view={view} onResult={report} />

        <ChangeRequests
          tripId={view.id}
          proposals={view.proposals}
          callsLeft={callsLeft}
          onResult={report}
        />

        <div aria-live="polite" className="min-h-0">
          {message ? (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={`rounded-control px-3 py-2.5 text-ui font-semibold ${
                message.tone === "error"
                  ? "bg-negative-bg text-negative"
                  : "bg-raised text-positive"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </div>

        <nav aria-label="Show on the map" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={selectedDay === null}
            onClick={() => setSelectedDay(null)}
            className={`pressable min-h-9 rounded-full px-3.5 text-meta font-semibold ${
              selectedDay === null
                ? "bg-primary text-primary-ink"
                : "bg-raised text-ink hover:bg-active"
            }`}
          >
            All days
          </button>
          {view.days.map((d) => (
            <button
              key={d.index}
              type="button"
              aria-pressed={selectedDay === d.index}
              onClick={() => setSelectedDay(selectedDay === d.index ? null : d.index)}
              style={hueStyle(dayHue(d.index))}
              className={`pressable inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-meta font-semibold ${
                selectedDay === d.index ? "hue-fill" : "hue-chip hover:brightness-95"
              }`}
            >
              {selectedDay !== d.index ? (
                <span aria-hidden="true" className="hue-mark size-2 rounded-full" />
              ) : null}
              Day {d.index + 1} · {dayLabel(d.date)}
            </button>
          ))}
        </nav>

        <DndContext
          id={dndId}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "Press space to pick up a stop. Use the arrow keys to move it within or between days, space to drop it, or escape to cancel.",
            },
          }}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={() => setDragStart(columns)}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            if (dragStart) setColumns(dragStart);
            setDragStart(null);
          }}
        >
          <div className="flex flex-col gap-10">
            {view.days.map((day) => (
              <DayColumn
                key={day.index}
                day={day}
                stops={(columns[day.index] ?? []).flatMap((id) => {
                  const s = stopsById.get(id);
                  return s ? [s] : [];
                })}
                dayCount={view.dayCount}
                currency={view.currency}
                pace={PACE_LABELS[view.pace].toLowerCase()}
                budget={BUDGET_LABELS[view.budget].toLowerCase()}
                hotStop={hotStop}
                stale={stale}
                busy={pending}
                onHover={setHotStop}
                onShow={show}
                onMove={move}
                onRemove={remove}
                onUpdate={update}
                onMode={setMode}
                onOptimise={optimise}
              />
            ))}
          </div>
        </DndContext>

        <Spares view={view} busy={pending} onAdd={add} />

        {credited.length > 0 ? (
          <section aria-labelledby="credits-heading" className="flex flex-col gap-2">
            <h2 id="credits-heading" className="text-ui font-semibold">
              Photo credits
            </h2>
            <ul className="flex flex-col gap-1 text-[0.75rem] leading-5 text-muted">
              {credited.map((s: StopView) => (
                <li key={s.id}>
                  {s.name}: <PhotoCredit photo={s.photo!} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="order-first h-72 min-w-0 sm:h-96 lg:sticky lg:top-6 lg:order-2 lg:h-[calc(100svh-3rem)]">
        <TripMap
          token={mapToken}
          days={mapDays}
          selectedDay={selectedDay}
          hotStop={hotStop}
          focusStop={focusStop}
          onHover={setHotStop}
          onPick={pick}
        />
      </div>
    </div>
  );
}

/** Saved places in this city that aren't in the trip, each one click from any day. */
function Spares({
  view,
  busy,
  onAdd,
}: {
  view: TripView;
  busy: boolean;
  onAdd: (sourceKey: string, day: number) => void;
}) {
  const [days, setDays] = useState<Record<string, number>>({});
  return (
    <section aria-labelledby="spares-heading" className="flex flex-col gap-3">
      <h2 id="spares-heading" className="text-body font-semibold">
        Saved in {view.cityName}, not in this trip
      </h2>
      {view.spares.length === 0 ? (
        <p className="text-ui text-muted">
          Every place you saved here is in the trip. Find more in{" "}
          <Link href={`/drift/${view.cityId}`} className="underline underline-offset-4">
            Drift
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel">
          {view.spares.map((spare) => (
            <li
              key={spare.sourceKey}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="flex flex-col">
                <span className="text-ui font-semibold">{spare.name}</span>
                <span className="text-meta text-muted">{spare.category}</span>
              </span>
              <span className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`spare-${spare.sourceKey}`}>
                  Day for {spare.name}
                </label>
                <select
                  id={`spare-${spare.sourceKey}`}
                  value={days[spare.sourceKey] ?? 0}
                  onChange={(e) =>
                    setDays((d) => ({ ...d, [spare.sourceKey]: Number(e.target.value) }))
                  }
                  className="min-h-9 rounded-control border border-control bg-panel px-2 text-ui"
                >
                  {view.days.map((d) => (
                    <option key={d.index} value={d.index}>
                      Day {d.index + 1}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAdd(spare.sourceKey, days[spare.sourceKey] ?? 0)}
                  className="pressable min-h-9 rounded-control border border-control bg-panel px-3 text-ui font-semibold hover:bg-raised disabled:opacity-60"
                >
                  Add
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
