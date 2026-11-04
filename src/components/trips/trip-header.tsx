"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { countryName } from "@/lib/atlas/countries";
import { deleteTrip, renameTrip, type TripActionResult } from "@/lib/trips/actions";
import type { TripView } from "@/lib/trips/view";
import { tripDates } from "./trip-card";

/** The trip's name (renamable), where and when, and a delete that asks first, in the page. */
export function TripHeader({
  view,
  onResult,
}: {
  view: TripView;
  onResult: (result: TripActionResult) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(view.title);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const stops = view.days.reduce((n, d) => n + d.stops.length, 0);

  return (
    <header className="flex flex-col gap-3">
      <Link href="/trips" className="w-fit text-meta text-muted underline-offset-4 hover:underline">
        All trips
      </Link>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await renameTrip({ tripId: view.id, title });
              onResult(result);
              if (result.ok) setEditing(false);
            });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <label htmlFor="trip-title" className="sr-only">
            Trip name
          </label>
          <input
            id="trip-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            autoFocus
            className="min-h-11 min-w-0 flex-1 rounded-control border border-control bg-panel px-3 text-title font-semibold"
          />
          <button
            type="submit"
            disabled={pending}
            className="pressable min-h-10 rounded-control bg-primary px-4 text-ui font-semibold text-primary-ink"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle(view.title);
              setEditing(false);
            }}
            className="pressable min-h-10 px-2 text-ui text-muted hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-title font-semibold tracking-[-0.01em]">{view.title}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-meta text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Rename
          </button>
        </div>
      )}
      <p className="text-ui text-muted">
        {view.cityName}, {countryName(view.countryCode)} ·{" "}
        {tripDates(view.startDate, view.dayCount)} · {view.dayCount}{" "}
        {view.dayCount === 1 ? "day" : "days"} · {stops} {stops === 1 ? "stop" : "stops"}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-meta">
        {confirming ? (
          <form action={deleteTrip} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="tripId" value={view.id} />
            <span className="font-semibold">Delete this trip? This can&apos;t be undone.</span>
            <button
              type="submit"
              className="pressable min-h-9 rounded-control bg-negative px-3 font-semibold text-panel"
            >
              Delete trip
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="pressable min-h-9 px-2 text-muted hover:text-ink"
            >
              Keep it
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-muted underline-offset-4 hover:text-negative hover:underline"
          >
            Delete trip
          </button>
        )}
      </div>
    </header>
  );
}
