"use client";

import { useEffect, useId, useRef, useState } from "react";
import { countryName } from "@/lib/atlas/countries";

export type CityOption = { id: number; name: string; region: string | null; countryCode: string };

const DEBOUNCE_MS = 200;

function describe(city: CityOption) {
  return [city.region, countryName(city.countryCode)]
    .filter((part) => part && part !== city.name)
    .join(", ");
}

/**
 * City typeahead (WAI-ARIA combobox with a listbox popup). Arrow keys move through results, Enter
 * picks, Escape closes. Requests are debounced and stale ones cancelled.
 */
export function CitySearch({
  value,
  onChange,
}: {
  value: CityOption | null;
  onChange: (city: CityOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const listId = useId();
  const inputId = useId();
  const statusId = useId();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || value) return;
    const timer = window.setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setStatus("loading");
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`search failed (${response.status})`);
        const body = (await response.json()) as { results: CityOption[] };
        setResults(body.results);
        setActive(body.results.length > 0 ? 0 : -1);
        setOpen(true);
        setStatus("idle");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  const choose = (city: CityOption) => {
    onChange(city);
    setQuery(`${city.name}, ${countryName(city.countryCode)}`);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      const city = results[active];
      if (city) choose(city);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const message =
    status === "error"
      ? "Search isn't working right now. Try again in a moment."
      : open && results.length === 0
        ? "No cities match. Check the spelling, or add the whole country instead."
        : "";

  return (
    <div className="relative flex flex-col gap-2">
      <label htmlFor={inputId} className="text-ui font-semibold">
        City
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={statusId}
        autoComplete="off"
        placeholder="Start typing, e.g. Lisbon"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (value) onChange(null);
          if (event.target.value.trim().length < 2) {
            setResults([]);
            setOpen(false);
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="min-h-11 rounded-control border border-control bg-panel px-3 text-body focus-visible:border-accent focus-visible:outline-none"
      />
      <p id={statusId} aria-live="polite" className="text-meta text-muted empty:hidden">
        {status === "loading" ? "Searching…" : message}
      </p>
      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching cities"
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-card border border-border bg-panel py-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)]"
        >
          {results.map((city, index) => (
            <li
              key={city.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(city)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer flex-col px-3 py-2 ${index === active ? "bg-active" : ""}`}
            >
              <span className="text-ui font-semibold">{city.name}</span>
              <span className="text-meta text-muted">{describe(city)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
