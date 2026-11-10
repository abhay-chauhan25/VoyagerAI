"use client";

import { useState, useTransition } from "react";
import { DriftCardRow } from "@/components/drift/drift-card";
import type { ActivityCard } from "@/lib/drift/cards";
import type { VoteTally } from "@/lib/huddle/queries";
import { addStop } from "@/lib/trips/actions";
import { VoteButtons } from "./vote-buttons";

export type Match = { card: ActivityCard; fans: string[]; inTrip: boolean };

type Props = {
  tripId: string;
  dayCount: number;
  canEdit: boolean;
  matches: Match[];
  votes: Record<string, VoteTally>;
  myName: string;
};

/** Places the group agreed on: who loved each, votes on adding it, and (for editors) the add button. */
export function Matches({ tripId, dayCount, canEdit, matches, votes, myName }: Props) {
  const [days, setDays] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, start] = useTransition();

  const add = (sourceKey: string) =>
    start(async () => {
      const result = await addStop({ tripId, sourceKey, day: days[sourceKey] ?? 0 });
      setMessage(
        result.ok
          ? { text: "Added to the trip.", tone: "ok" }
          : { text: result.message, tone: "error" },
      );
    });

  if (matches.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-control px-5 py-6 text-ui text-muted">
        No matches yet. A place matches when at least two of you love it and nobody passes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite">
        {message ? (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`text-meta font-semibold ${message.tone === "error" ? "text-negative" : "text-positive"}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel px-4">
        {matches.map(({ card, fans, inTrip }) => (
          <li key={card.sourceKey}>
            <DriftCardRow card={{ ...card, why: `${fans.join(", ")} loved it. ${card.why}` }}>
              <VoteButtons
                tripId={tripId}
                subject={`place:${card.sourceKey}`}
                tally={votes[`place:${card.sourceKey}`]}
                myName={myName}
              />
              {inTrip ? (
                <span className="text-meta font-semibold text-positive">In the trip</span>
              ) : canEdit ? (
                <span className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`match-day-${card.sourceKey}`}>
                    Day for {card.name}
                  </label>
                  <select
                    id={`match-day-${card.sourceKey}`}
                    value={days[card.sourceKey] ?? 0}
                    onChange={(e) =>
                      setDays((d) => ({ ...d, [card.sourceKey]: Number(e.target.value) }))
                    }
                    className="min-h-8 rounded-control border border-control bg-panel px-2 text-meta"
                  >
                    {Array.from({ length: dayCount }, (_, i) => (
                      <option key={i} value={i}>
                        Day {i + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add(card.sourceKey)}
                    className="pressable min-h-8 rounded-control border border-control px-3 text-meta font-semibold hover:bg-raised disabled:opacity-60"
                  >
                    Add to trip
                  </button>
                </span>
              ) : null}
            </DriftCardRow>
          </li>
        ))}
      </ul>
    </div>
  );
}
