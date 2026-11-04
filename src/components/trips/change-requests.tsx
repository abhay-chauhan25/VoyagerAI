"use client";

import { useId, useState, useTransition } from "react";
import { askForChanges, decideProposal, type TripActionResult } from "@/lib/trips/actions";
import { dayHue, hueStyle } from "@/lib/hues";
import type { ProposalView } from "@/lib/trips/view";

type Props = {
  tripId: string;
  proposals: ProposalView[];
  callsLeft: number;
  onResult: (result: TripActionResult) => void;
};

const EXAMPLES = ["Make day 1 slower", "It's raining on day 2", "Add more to the last day"];

/** One proposal: every change listed with its reason, each accepted or rejected by its checkbox. */
function ProposalCard({
  tripId,
  proposal,
  onResult,
}: {
  tripId: string;
  proposal: ProposalView;
  onResult: Props["onResult"];
}) {
  const [accepted, setAccepted] = useState<Set<number>>(
    () => new Set(proposal.changes.map((_, i) => i)),
  );
  const [pending, start] = useTransition();
  const decide = (accept: number[]) =>
    start(async () => onResult(await decideProposal({ tripId, proposalId: proposal.id, accept })));

  return (
    <article
      aria-label={`Proposal for: ${proposal.request}`}
      className="flex flex-col gap-3 rounded-card border border-border bg-panel p-4"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-meta text-muted">
          You asked: “{proposal.request}” ·{" "}
          {proposal.source === "compass" ? "Compass suggests" : "Suggested without AI"}
        </p>
        <p className="text-ui font-semibold">{proposal.summary}</p>
      </div>
      {proposal.changes.length > 0 ? (
        <>
          <ul className="flex flex-col gap-2">
            {proposal.changes.map((change, i) => {
              const day = change.type === "remove" ? null : change.toDay;
              return (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-control px-2 py-1.5 hover:bg-raised">
                    <input
                      type="checkbox"
                      checked={accepted.has(i)}
                      disabled={pending}
                      onChange={(e) =>
                        setAccepted((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          return next;
                        })
                      }
                      className="mt-1 size-4 accent-[var(--accent)]"
                    />
                    <span className="flex flex-col">
                      <span className="flex items-center gap-2 text-ui font-semibold">
                        {day !== null ? (
                          <span
                            aria-hidden="true"
                            style={hueStyle(dayHue(day))}
                            className="hue-mark size-2 rounded-full"
                          />
                        ) : null}
                        {change.label}
                      </span>
                      <span className="text-meta text-muted">{change.reason}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || accepted.size === 0}
              onClick={() => decide([...accepted])}
              className="pressable min-h-10 rounded-control bg-primary px-4 text-ui font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
            >
              {pending
                ? "Applying…"
                : accepted.size === proposal.changes.length
                  ? "Accept all"
                  : `Accept ${accepted.size} of ${proposal.changes.length}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide([])}
              className="pressable min-h-10 px-2 text-ui text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Reject all
            </button>
          </div>
        </>
      ) : (
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide([])}
            className="pressable min-h-10 rounded-control border border-control bg-panel px-4 text-ui hover:bg-raised"
          >
            OK
          </button>
        </div>
      )}
    </article>
  );
}

/**
 * Ask for changes in plain words. Compass (or the rule-based fallback) answers with a list of
 * proposed changes; nothing in the trip changes until the traveller accepts some of them.
 */
export function ChangeRequests({ tripId, proposals, callsLeft, onResult }: Props) {
  const [request, setRequest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputId = useId();

  const submit = (text: string) => {
    setError(null);
    start(async () => {
      const result = await askForChanges({ tripId, request: text });
      if (result.ok) setRequest("");
      else setError(result.message);
    });
  };

  return (
    <section aria-labelledby={`${inputId}-heading`} className="flex flex-col gap-3">
      <h2 id={`${inputId}-heading`} className="text-body font-semibold">
        Ask Compass to change this trip
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(request);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          What should change?
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            maxLength={300}
            placeholder="e.g. make day 2 slower"
            aria-describedby={`${inputId}-hint`}
            aria-invalid={error ? true : undefined}
            className="min-h-11 min-w-0 flex-1 rounded-control border border-control bg-panel px-3 text-body placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={pending || request.trim().length < 3}
            className="pressable min-h-11 rounded-control bg-primary px-4 text-ui font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Thinking…" : "Ask"}
          </button>
        </div>
        <p id={`${inputId}-hint`} className="text-meta text-muted">
          Compass proposes; you decide. {callsLeft} Compass{" "}
          {callsLeft === 1 ? "request" : "requests"} left today
          {callsLeft === 0 ? ", so simple requests are handled without AI" : ""}.
        </p>
        {error ? (
          <p role="alert" className="text-meta font-semibold text-negative">
            {error}
          </p>
        ) : null}
        {proposals.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={pending}
                onClick={() => setRequest(example)}
                className="pressable min-h-8 rounded-full border border-control px-3 text-meta text-muted hover:bg-raised hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}
      </form>
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id} tripId={tripId} proposal={proposal} onResult={onResult} />
      ))}
    </section>
  );
}
