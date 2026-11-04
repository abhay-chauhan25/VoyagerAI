"use client";

import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useState } from "react";
import { dayHue, hueStyle, nameHue } from "@/lib/hues";
import { formatMinute } from "@/lib/trips/schedule";
import { PRICE_LABELS, PRICE_LEVELS, type PriceLevel } from "@/lib/trips/stops";
import type { StopView } from "@/lib/trips/view";

type Props = {
  stop: StopView;
  number: number;
  day: number;
  dayCount: number;
  currency: string;
  hot: boolean;
  /** Times are being recalculated after a change. */
  stale: boolean;
  onHover: (id: string | null) => void;
  onShow: (id: string) => void;
  onMove: (id: string, toDay: number) => void;
  onRemove: (id: string) => void;
  onUpdate: (
    id: string,
    fields: { priceLevel?: PriceLevel; costAmount?: number | null; dwell?: number },
  ) => void;
};

const DWELL_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300];

function dwellLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`;
}

function hoursNote(stop: StopView): { text: string; tone: "warning" | "muted" } | null {
  if (stop.state === "closed")
    return { text: `Closed at this time · hours: ${stop.openingHours}`, tone: "warning" };
  if (stop.state === "closes-during")
    return { text: `Closes before you leave · hours: ${stop.openingHours}`, tone: "warning" };
  if (stop.state === "unknown" && stop.openingHours)
    return { text: `Hours couldn't be checked: ${stop.openingHours}`, tone: "muted" };
  return null;
}

/** One stop in the timeline. The handle drags it (mouse, touch or keyboard); the menu offers the same moves. */
export function StopRow({
  stop,
  number,
  day,
  dayCount,
  currency,
  hot,
  stale,
  onHover,
  onShow,
  onMove,
  onRemove,
  onUpdate,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id, data: { day } });
  const [amount, setAmount] = useState(stop.costAmount === null ? "" : String(stop.costAmount));
  const ids = useId();
  const note = hoursNote(stop);

  const saveAmount = () => {
    const trimmed = amount.trim().replace(",", ".");
    if (trimmed === "") {
      if (stop.costAmount !== null) onUpdate(stop.id, { costAmount: null });
      return;
    }
    const value = Math.round(Number(trimmed) * 100) / 100;
    if (Number.isFinite(value) && value >= 0 && value !== stop.costAmount)
      onUpdate(stop.id, { costAmount: value });
  };

  return (
    <li
      ref={setNodeRef}
      data-stop-id={stop.id}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        ...hueStyle(dayHue(day)),
      }}
      onMouseEnter={() => onHover(stop.id)}
      onMouseLeave={() => onHover(null)}
      className={`relative rounded-card bg-panel transition-[background-color,box-shadow] duration-150 ${
        isDragging ? "z-10 shadow-[0_12px_28px_rgb(0_0_0/0.22)]" : ""
      } ${hot && !isDragging ? "bg-raised" : ""}`}
    >
      <div className="flex gap-3 p-3">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move ${stop.name}. Press space to pick up, arrows to move, space to drop.`}
          className="hue-fill pressable flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-meta font-bold active:cursor-grabbing"
        >
          {number}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h4 className="min-w-0 text-ui leading-snug font-semibold">
              <button
                type="button"
                onClick={() => onShow(stop.id)}
                className="text-left underline-offset-4 hover:underline"
              >
                {stop.name}
              </button>
            </h4>
            <span
              className={`text-meta tabular-nums ${stale ? "text-muted/60" : "text-muted"}`}
              title={stale ? "Updating times…" : undefined}
            >
              {formatMinute(stop.arrive)}–{formatMinute(stop.leave)}
            </span>
          </div>
          <p className="text-meta text-muted">
            {stop.category} · {dwellLabel(stop.dwell)} · {PRICE_LABELS[stop.priceLevel]}
            {stop.costAmount !== null ? ` (${stop.costAmount} ${currency})` : ""}
          </p>
          {note ? (
            <p
              className={`text-meta ${
                note.tone === "warning"
                  ? "w-fit rounded-control bg-warning-bg px-2 py-0.5 font-semibold text-warning"
                  : "text-muted"
              }`}
            >
              {note.text}
            </p>
          ) : null}

          <details className="group/edit mt-1">
            <summary className="w-fit cursor-pointer list-none text-meta text-muted underline-offset-4 hover:text-ink hover:underline [&::-webkit-details-marker]:hidden">
              Edit stop
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-meta font-semibold">
                Price level
                <select
                  value={stop.priceLevel}
                  onChange={(e) =>
                    onUpdate(stop.id, { priceLevel: Number(e.target.value) as PriceLevel })
                  }
                  className="min-h-9 rounded-control border border-control bg-panel px-2 text-ui font-normal"
                >
                  {PRICE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {PRICE_LABELS[level]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${ids}-amount`} className="text-meta font-semibold">
                  Exact amount ({currency})
                </label>
                <input
                  id={`${ids}-amount`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={saveAmount}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveAmount();
                    }
                  }}
                  placeholder="Optional"
                  aria-describedby={`${ids}-amount-hint`}
                  className="min-h-9 rounded-control border border-control bg-panel px-2 text-ui tabular-nums"
                />
                <span id={`${ids}-amount-hint`} className="text-meta text-muted">
                  0 or more; leave empty to use the price level.
                </span>
              </div>
              <label className="flex flex-col gap-1 text-meta font-semibold">
                Time there
                <select
                  value={stop.dwell}
                  onChange={(e) => onUpdate(stop.id, { dwell: Number(e.target.value) })}
                  className="min-h-9 rounded-control border border-control bg-panel px-2 text-ui font-normal"
                >
                  {[...new Set([...DWELL_OPTIONS, stop.dwell])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <option key={m} value={m}>
                        {dwellLabel(m)}
                      </option>
                    ))}
                </select>
              </label>
              {dayCount > 1 ? (
                <label className="flex flex-col gap-1 text-meta font-semibold">
                  Move to
                  <select
                    value={day}
                    onChange={(e) => onMove(stop.id, Number(e.target.value))}
                    className="min-h-9 rounded-control border border-control bg-panel px-2 text-ui font-normal"
                  >
                    {Array.from({ length: dayCount }, (_, i) => (
                      <option key={i} value={i}>
                        Day {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => onRemove(stop.id)}
                  className="pressable min-h-9 text-meta font-semibold text-negative underline-offset-4 hover:underline"
                >
                  Remove from trip
                </button>
                <a
                  href={stop.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-meta text-muted underline underline-offset-2"
                >
                  {stop.dataSource === "OpenStreetMap"
                    ? "Data © OpenStreetMap contributors"
                    : "Wikipedia (CC BY-SA)"}
                </a>
              </div>
            </div>
          </details>
        </div>

        <div
          style={hueStyle(nameHue(stop.name))}
          className="hue-fill relative hidden size-16 shrink-0 overflow-hidden rounded-control sm:block"
        >
          {stop.photo ? (
            <Image
              src={stop.photo.url}
              unoptimized
              alt=""
              fill
              sizes="4rem"
              className="pointer-events-none object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 left-2 font-display text-lead leading-none font-extrabold uppercase"
            >
              {stop.name.slice(0, 2)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
