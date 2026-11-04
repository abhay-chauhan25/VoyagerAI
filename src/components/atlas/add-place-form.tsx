"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addVisit } from "@/lib/atlas/actions";
import { COUNTRY_CODES, countryName } from "@/lib/atlas/countries";
import { MIN_VISIT_YEAR } from "@/lib/atlas/schemas";
import { initialFormState } from "@/lib/auth/form-state";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { CitySearch, type CityOption } from "./city-search";

type Mode = "city" | "country";

export function AddPlaceForm() {
  const [state, action] = useActionState(addVisit, initialFormState);
  const [mode, setMode] = useState<Mode>("city");
  const [city, setCity] = useState<CityOption | null>(null);
  const [formKey, setFormKey] = useState(0);
  const lastHandled = useRef(state);

  // After a successful add, start a fresh form (new key) so the next place begins empty.
  useEffect(() => {
    if (state !== lastHandled.current && state.status === "success") {
      lastHandled.current = state;
      setFormKey((k) => k + 1);
      setCity(null);
    }
  }, [state]);

  const thisYear = new Date().getFullYear();

  return (
    <form key={formKey} action={action} className="flex flex-col gap-4" noValidate>
      <div
        role="radiogroup"
        aria-label="What to add"
        className="inline-flex self-start rounded-control bg-raised p-0.5 text-meta"
      >
        {(
          [
            ["city", "A city"],
            ["country", "A whole country"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={`pressable min-h-8 rounded-[3px] px-3 ${mode === value ? "bg-panel text-ink" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "city" ? (
        <>
          <CitySearch value={city} onChange={setCity} />
          <input type="hidden" name="cityId" value={city?.id ?? ""} />
          {state.fieldErrors?.cityId ? (
            <p className="-mt-2 text-meta font-semibold text-negative">
              Choose a city from the list.
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="add-country" className="text-ui font-semibold">
            Country
          </label>
          <select
            id="add-country"
            name="countryCode"
            defaultValue=""
            className="min-h-11 rounded-control border border-control bg-panel px-3 text-body focus-visible:border-accent focus-visible:outline-none"
          >
            <option value="" disabled>
              Choose a country
            </option>
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {countryName(code)}
              </option>
            ))}
          </select>
          {state.fieldErrors?.countryCode || state.fieldErrors?.cityId ? (
            <p className="text-meta font-semibold text-negative">Choose a country.</p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="add-year" className="text-ui font-semibold">
          Year (optional)
        </label>
        <input
          id="add-year"
          name="year"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder={String(thisYear)}
          aria-describedby="add-year-hint"
          className="min-h-11 w-32 rounded-control border border-control bg-panel px-3 text-body tabular-nums focus-visible:border-accent focus-visible:outline-none"
        />
        <p id="add-year-hint" className="text-meta text-muted">
          {MIN_VISIT_YEAR} to {thisYear}.
        </p>
        {state.fieldErrors?.year ? (
          <p className="text-meta font-semibold text-negative">
            Use a year from {MIN_VISIT_YEAR} to {thisYear}.
          </p>
        ) : null}
      </div>

      <FormMessage state={state} />
      <SubmitButton className="self-start" pendingLabel="Adding…">
        Add to map
      </SubmitButton>
    </form>
  );
}
