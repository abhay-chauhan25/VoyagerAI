"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Fragment } from "react";
import { dayHue, hueStyle } from "@/lib/hues";
import type { TravelMode } from "@/lib/trips/schemas";
import { formatDuration } from "@/lib/trips/schedule";
import type { DayView, StopView } from "@/lib/trips/view";
import { StopRow } from "./stop-row";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function dayLabel(date: string): string {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A filled bar against a limit; past the limit it turns to the warning colour and says by how much. */
function Meter({
  label,
  value,
  limit,
  valueText,
  overText,
}: {
  label: string;
  value: number;
  limit: number;
  valueText: string;
  overText: string;
}) {
  const over = value > limit;
  const share = Math.min(1, limit > 0 ? value / limit : 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-meta">
        <span className="text-muted">{label}</span>
        <span className={`font-semibold ${over ? "text-warning" : "text-ink"}`}>
          {over ? overText : valueText}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={value}
        aria-valuetext={over ? overText : valueText}
        className="h-1.5 overflow-hidden rounded-full bg-raised"
      >
        <div
          style={{ transform: `scaleX(${share})` }}
          className={`h-full origin-left rounded-full transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none ${
            over ? "bg-warning" : "hue-mark"
          }`}
        />
      </div>
    </div>
  );
}

type Props = {
  day: DayView;
  stops: StopView[];
  dayCount: number;
  currency: string;
  pace: string;
  budget: string;
  hotStop: string | null;
  stale: boolean;
  busy: boolean;
  onHover: (id: string | null) => void;
  onShow: (id: string) => void;
  onMove: (id: string, toDay: number) => void;
  onRemove: (id: string) => void;
  onUpdate: Parameters<typeof StopRow>[0]["onUpdate"];
  onMode: (day: number, mode: TravelMode) => void;
  onOptimise: (day: number) => void;
};

/** One day: its colour, name, meters, travel mode, and its stops with the travel between them. */
export function DayColumn({
  day,
  stops,
  dayCount,
  currency,
  pace,
  budget,
  hotStop,
  stale,
  busy,
  onHover,
  onShow,
  onMove,
  onRemove,
  onUpdate,
  onMode,
  onOptimise,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.index}`, data: { day: day.index } });
  const hue = dayHue(day.index);
  const verb = day.mode === "walking" ? "walk" : "drive";

  return (
    <section
      aria-labelledby={`day-${day.index}-heading`}
      style={hueStyle(hue)}
      className="flex flex-col gap-3"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hue-fill rounded-full px-3 py-1 text-meta font-bold whitespace-nowrap">
              Day {day.index + 1} · {dayLabel(day.date)}
            </span>
            <h3
              id={`day-${day.index}-heading`}
              className="min-w-0 truncate text-body font-semibold"
            >
              {day.title ?? (stops.length ? `Day ${day.index + 1}` : "A free day")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label={`Travel on day ${day.index + 1}`}
              className="flex rounded-control bg-raised p-0.5"
            >
              {(["walking", "driving"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={day.mode === mode}
                  disabled={busy}
                  onClick={() => day.mode !== mode && onMode(day.index, mode)}
                  className={`pressable min-h-8 rounded-[3px] px-2.5 text-meta ${
                    day.mode === mode
                      ? "bg-panel font-semibold text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {mode === "walking" ? "Walk" : "Drive"}
                </button>
              ))}
            </div>
            {stops.length > 2 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onOptimise(day.index)}
                className="pressable min-h-8 rounded-control px-2.5 text-meta text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Best order
              </button>
            ) : null}
          </div>
        </div>
        {stops.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Meter
              label="Pace"
              value={day.busyMinutes}
              limit={day.paceLimit}
              valueText={`${hours(day.busyMinutes)} busy of ${hours(day.paceLimit)} (${pace})`}
              overText={`${hours(day.busyMinutes - day.paceLimit)} over your ${pace} pace`}
            />
            <Meter
              label="Budget"
              value={day.pricePoints}
              limit={day.budgetPoints}
              valueText={`${"$".repeat(Math.max(1, day.pricePoints))}${day.pricePoints === 0 ? " · all free" : ""} · within ${budget}${day.amount !== null ? ` · ${day.amount} ${currency} entered` : ""}`}
              overText={`Above your ${budget} budget${day.amount !== null ? ` · ${day.amount} ${currency} entered` : ""}`}
            />
          </div>
        ) : null}
      </header>

      <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          aria-label={`Stops on day ${day.index + 1}`}
          className={`flex min-h-20 flex-col gap-1 rounded-card transition-colors duration-150 ${
            isOver ? "hue-chip" : ""
          } ${stops.length === 0 ? "border border-dashed border-control" : ""}`}
        >
          {stops.length === 0 ? (
            <li className="flex min-h-20 items-center justify-center px-4 text-center text-meta text-muted">
              Drag a stop here, or add one from your saves below.
            </li>
          ) : (
            stops.map((stop, i) => (
              <Fragment key={stop.id}>
                <StopRow
                  stop={stop}
                  number={i + 1}
                  day={day.index}
                  dayCount={dayCount}
                  currency={currency}
                  hot={hotStop === stop.id}
                  stale={stale}
                  onHover={onHover}
                  onShow={onShow}
                  onMove={onMove}
                  onRemove={onRemove}
                  onUpdate={onUpdate}
                />
                {i < stops.length - 1 && stop.next ? (
                  <li
                    aria-hidden={stale}
                    className="flex items-center gap-2 py-1 pl-6 text-meta text-muted"
                  >
                    <span className="hue-mark h-4 w-0.5 rounded-full" aria-hidden="true" />
                    {stale ? "Updating…" : `${formatDuration(stop.next.seconds)} ${verb}`}
                    {!stale && day.timesSource === "estimate" ? (
                      <span className="text-muted/80">(estimate)</span>
                    ) : null}
                  </li>
                ) : null}
              </Fragment>
            ))
          )}
        </ol>
      </SortableContext>
      {stops.length > 1 ? (
        <p className="text-meta text-muted">
          {formatDuration(day.travelMinutes * 60)} of travel ·{" "}
          {day.timesSource === "mapbox"
            ? "times from Mapbox"
            : "straight-line estimates (real times need MAPBOX_SERVER_TOKEN, or Mapbox was unavailable)"}
        </p>
      ) : null}
    </section>
  );
}
