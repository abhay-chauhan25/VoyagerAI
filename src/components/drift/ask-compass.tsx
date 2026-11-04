"use client";

import { useActionState, useState, useTransition } from "react";
import { askCompassAction, judgeCard, type AskState } from "@/lib/drift/actions";
import type { DestinationCard } from "@/lib/drift/cards";
import { AtlasMap } from "@/components/atlas/atlas-map";
import { SubmitButton } from "@/components/ui/submit-button";
import { DriftCardRow, ExploreLink } from "./drift-card";

const EXAMPLES = [
  "Somewhere warm in March with great food",
  "A slow week of museums and cafés",
  "Mountains and wine, not too busy",
];

function SaveButton({ card }: { card: DestinationCard }) {
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || state === "saved"}
      onClick={() =>
        startTransition(async () => {
          const result = await judgeCard({ card, verdict: "love" });
          setState(result.ok ? "saved" : "error");
        })
      }
      className="pressable text-meta font-semibold underline underline-offset-4 disabled:no-underline disabled:opacity-70"
    >
      {state === "saved"
        ? "Saved"
        : state === "error"
          ? "Couldn't save, try again"
          : pending
            ? "Saving…"
            : `Save ${card.name}`}
    </button>
  );
}

export function AskCompass({ mapboxToken }: { mapboxToken: string | undefined }) {
  const [state, action] = useActionState<AskState, FormData>(askCompassAction, {
    status: "idle",
    query: "",
  });
  const [query, setQuery] = useState("");
  const results = state.status === "done" ? state.cards : [];

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-3">
        <label htmlFor="ask-query" className="text-body font-semibold">
          Ask Compass
        </label>
        <textarea
          id="ask-query"
          name="query"
          rows={2}
          maxLength={300}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Describe the trip you want, in your own words"
          aria-describedby="ask-hint"
          className="w-full resize-none rounded-control border border-control bg-panel px-3 py-2.5 text-body focus-visible:border-accent focus-visible:outline-none"
        />
        <div id="ask-hint" className="flex flex-wrap items-center gap-2 text-meta text-muted">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuery(example)}
              className="pressable rounded-[3px] bg-raised px-2 py-1 text-ink hover:bg-active"
            >
              {example}
            </button>
          ))}
        </div>
        {state.status === "error" ? (
          <p role="alert" className="text-ui font-semibold text-negative">
            {state.message}
          </p>
        ) : null}
        <SubmitButton className="self-start" pendingLabel="Compass is thinking…">
          Ask
        </SubmitButton>
      </form>

      {state.status === "done" ? (
        <section aria-labelledby="answer-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="answer-heading" className="text-body font-semibold">
              {state.source === "compass" ? "Compass suggests" : "Results"}
            </h2>
            {state.summary ? <p className="text-ui text-muted">{state.summary}</p> : null}
            {state.notice ? (
              <p role="status" className="rounded-control bg-surface px-3 py-2 text-ui">
                {state.notice}
              </p>
            ) : null}
          </div>
          {results.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <ul className="flex flex-col divide-y divide-rule rounded-card border border-border bg-panel px-4">
                {results.map((card) => (
                  <li key={card.sourceKey}>
                    <DriftCardRow card={card}>
                      <SaveButton card={card} />
                      <ExploreLink cityId={card.cityId} name={card.name} />
                    </DriftCardRow>
                  </li>
                ))}
              </ul>
              <div className="h-80 lg:h-full lg:min-h-80">
                <AtlasMap
                  token={mapboxToken}
                  countryCodes={[]}
                  cities={results.map((c) => ({
                    id: c.cityId,
                    name: c.name,
                    latitude: c.latitude,
                    longitude: c.longitude,
                  }))}
                  label={`Globe marking ${results.length} suggested ${results.length === 1 ? "city" : "cities"}`}
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
