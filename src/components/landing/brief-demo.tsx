"use client";

import { useId, useMemo, useState } from "react";
import { formatBudget, parseTripBrief } from "@/lib/brief/parse-trip-brief";

const EXAMPLE =
  "Three slow days in Lisbon in May, mostly food and viewpoints, about €600 each, four of us";
const MAX_LENGTH = 280;
const HALF_HEADING =
  "pointer-events-none font-display text-[11vw] leading-none font-extrabold uppercase sm:text-display";

function Row({ label, value }: { label: string; value: React.ReactNode | null }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-t border-rule py-2.5">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="text-ui">
        {value ?? (
          <span className="text-muted" aria-label="not set">
            —
          </span>
        )}
      </dd>
    </div>
  );
}

/** The live thing: type a trip wish on the dark field, read the structured brief on the light one. */
export function BriefDemo() {
  const [text, setText] = useState(EXAMPLE);
  const brief = useMemo(() => parseTripBrief(text), [text]);
  const inputId = useId();

  const length = brief.days ? `${brief.days} ${brief.days === 1 ? "day" : "days"}` : null;

  return (
    <div className="grid lg:min-h-[90svh] lg:grid-cols-2">
      <div className="relative flex flex-col justify-start bg-night px-5 pt-16 pb-32 text-night-ink sm:px-10 lg:px-16 lg:pt-[18svh]">
        <div className="mb-4 flex max-w-[34ch] items-baseline justify-between gap-4 text-ui text-night-muted">
          <label htmlFor={inputId}>Describe a trip the way you&apos;d tell a friend</label>
          <span className="shrink-0 text-meta tabular-nums" aria-live="off">
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
        <textarea
          id={inputId}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          spellCheck={false}
          className="w-full max-w-[34ch] resize-none rounded-control bg-transparent text-[1.375rem] leading-snug text-night-ink outline-1 outline-transparent transition-[outline-color] duration-200 focus-visible:outline-night-muted"
        />
        <span
          aria-hidden="true"
          className={`${HALF_HEADING} absolute bottom-8 left-5 sm:left-10 lg:left-16`}
        >
          Your words,
        </span>
      </div>

      <div className="relative flex flex-col justify-start bg-bg px-5 pt-8 pb-16 sm:px-10 lg:px-16 lg:pt-[18svh] lg:pb-28">
        <span
          aria-hidden="true"
          className={`${HALF_HEADING} mb-8 text-ink lg:absolute lg:right-16 lg:bottom-8 lg:mb-0`}
        >
          your trip
        </span>
        <div
          data-ui
          className="w-full max-w-[30rem] rounded-card border border-border bg-panel p-5 text-ink"
        >
          <div className="flex items-baseline justify-between gap-3 pb-3">
            <h3 className="text-body font-semibold">Trip brief</h3>
            <span className="text-meta text-muted">Updates as you type</span>
          </div>
          <dl aria-live="polite">
            <Row label="Destination" value={brief.destination} />
            <Row label="Length" value={length} />
            <Row label="When" value={brief.when} />
            <Row label="Pace" value={brief.paceStated ? brief.pace : `${brief.pace} (default)`} />
            <Row
              label="Interests"
              value={
                brief.interests.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {brief.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-[3px] bg-raised px-2 py-0.5 text-meta"
                      >
                        {interest}
                      </span>
                    ))}
                  </span>
                ) : null
              }
            />
            <Row label="Budget" value={brief.budget ? formatBudget(brief.budget) : null} />
            <Row
              label="Travellers"
              value={
                brief.travellers
                  ? `${brief.travellers} ${brief.travellers === 1 ? "person" : "people"}`
                  : null
              }
            />
          </dl>
          <p className="border-t border-rule pt-3 text-meta text-muted">
            Read in your browser. Nothing you type here is sent anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}
