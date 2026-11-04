"use client";

import { useActionState, useState } from "react";
import { ChoiceGroup } from "@/components/dna/choice-group";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { initialFormState } from "@/lib/auth/form-state";
import { PACES, PACE_LABELS } from "@/lib/dna/schemas";
import { hueStyle, nameHue } from "@/lib/hues";
import { composeTripAction } from "@/lib/trips/actions";
import { MAX_DAYS } from "@/lib/trips/schemas";
import { PACE_PLAN } from "@/lib/trips/stops";

type City = { cityId: number; cityName: string; count: number };
type Pace = (typeof PACES)[number];

type Props = {
  cities: City[];
  initialCityId: number;
  defaultStart: string;
  defaultPace: Pace;
};

/** Days that fit a city's saves at a pace: enough for every save, at most a week by default. */
function suggestedDays(count: number, pace: Pace): number {
  return Math.min(7, Math.max(1, Math.ceil(count / PACE_PLAN[pace].stops)));
}

const PACE_HINTS: Record<Pace, string> = {
  slow: `${PACE_PLAN.slow.stops} stops a day`,
  balanced: `${PACE_PLAN.balanced.stops} stops a day`,
  full: `${PACE_PLAN.full.stops} stops a day`,
};

export function ComposeForm({ cities, initialCityId, defaultStart, defaultPace }: Props) {
  const [state, action] = useActionState(composeTripAction, initialFormState);
  const [cityId, setCityId] = useState(Number(state.values?.cityId) || initialCityId);
  const [pace, setPace] = useState<Pace>((state.values?.pace as Pace) || defaultPace);
  const city = cities.find((c) => c.cityId === cityId) ?? cities[0]!;
  const [days, setDays] = useState(
    Number(state.values?.days) || suggestedDays(city.count, defaultPace),
  );

  const pickCity = (next: City) => {
    setCityId(next.cityId);
    setDays(suggestedDays(next.count, pace));
  };

  return (
    <form action={action} className="flex flex-col gap-10" noValidate>
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-body font-semibold">Where</legend>
        <p className="-mt-2 text-meta text-muted">Cities where you have saved places in Drift.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => {
            const checked = c.cityId === cityId;
            return (
              <label
                key={c.cityId}
                style={hueStyle(nameHue(c.cityName))}
                className={`pressable flex min-h-16 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                  checked
                    ? "hue-chip border-[var(--hue)]"
                    : "border-border bg-panel hover:bg-raised"
                }`}
              >
                <input
                  type="radio"
                  name="cityId"
                  value={c.cityId}
                  checked={checked}
                  onChange={() => pickCity(c)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="hue-fill flex size-10 shrink-0 items-center justify-center rounded-control font-display text-lead font-extrabold uppercase"
                >
                  {c.cityName.slice(0, 1)}
                </span>
                <span className="flex flex-col">
                  <span className="text-ui font-semibold">{c.cityName}</span>
                  <span className="text-meta text-muted">
                    {c.count} saved {c.count === 1 ? "place" : "places"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {state.fieldErrors?.cityId ? (
          <p className="text-meta font-semibold text-negative">{state.fieldErrors.cityId}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="First day"
          name="startDate"
          type="date"
          required
          defaultValue={state.values?.startDate ?? defaultStart}
          hint="Opening hours are checked against these dates."
          error={state.fieldErrors?.startDate}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="compose-days" className="text-ui font-semibold">
            Days
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              disabled={days <= 1}
              aria-label="One day fewer"
              className="pressable size-11 rounded-control border border-control bg-panel text-lead hover:bg-raised disabled:opacity-40"
            >
              −
            </button>
            <input
              id="compose-days"
              name="days"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DAYS}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 1)}
              aria-describedby="compose-days-hint"
              className="min-h-11 w-20 rounded-control border border-control bg-panel px-3 text-center text-body tabular-nums"
            />
            <button
              type="button"
              onClick={() => setDays((d) => Math.min(MAX_DAYS, d + 1))}
              disabled={days >= MAX_DAYS}
              aria-label="One day more"
              className="pressable size-11 rounded-control border border-control bg-panel text-lead hover:bg-raised disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p id="compose-days-hint" className="text-meta text-muted">
            1 to {MAX_DAYS}. Suggested from your {city.count} saves at this pace.
          </p>
          {state.fieldErrors?.days ? (
            <p className="text-meta font-semibold text-negative">{state.fieldErrors.days}</p>
          ) : null}
        </div>
      </div>

      <ChoiceGroup
        legend="Pace"
        hint={`From your Travel DNA. ${PACE_HINTS[pace]}.`}
        name="pace"
        type="radio"
        options={PACES.map((p) => ({ value: p, label: PACE_LABELS[p] }))}
        selected={[pace]}
        onChange={(values) => {
          const next = (values[0] as Pace) ?? pace;
          setPace(next);
          setDays(suggestedDays(city.count, next));
        }}
      />

      <TextField
        label="Name (optional)"
        name="title"
        maxLength={80}
        placeholder={`${city.cityName}, ${days} ${days === 1 ? "day" : "days"}`}
        defaultValue={state.values?.title ?? ""}
        error={state.fieldErrors?.title}
      />

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pendingLabel="Composing…" size="lg">
            Compose trip
          </SubmitButton>
          <p className="text-meta text-muted">
            Groups nearby places into days, orders each day around opening hours, and fetches travel
            times. Takes a few seconds.
          </p>
        </div>
      </div>
    </form>
  );
}
