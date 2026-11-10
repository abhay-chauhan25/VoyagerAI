"use client";

import { useOptimistic, useTransition } from "react";
import { castVote } from "@/lib/huddle/actions";
import type { VoteTally } from "@/lib/huddle/queries";

type Props = { tripId: string; subject: string; tally: VoteTally | undefined; myName: string };

const EMPTY: VoteTally = { up: [], down: [], mine: 0 };

function without(names: readonly string[], name: string): string[] {
  const index = names.lastIndexOf(name);
  return index < 0 ? [...names] : [...names.slice(0, index), ...names.slice(index + 1)];
}

/** For and against, with who voted each way. Pressing your current vote takes it back. */
export function VoteButtons({ tripId, subject, tally = EMPTY, myName }: Props) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(tally, (current, value: -1 | 0 | 1): VoteTally => {
    // Take back my current vote, then add the new one.
    const up = current.mine === 1 ? without(current.up, myName) : current.up;
    const down = current.mine === -1 ? without(current.down, myName) : current.down;
    return {
      up: value === 1 ? [...up, myName] : up,
      down: value === -1 ? [...down, myName] : down,
      mine: value,
    };
  });

  const vote = (value: -1 | 1) => {
    const next = shown.mine === value ? 0 : value;
    start(async () => {
      setShown(next);
      await castVote({ tripId, subject, value: next });
    });
  };

  const button = (value: -1 | 1, label: string, names: string[]) => (
    <button
      type="button"
      aria-pressed={shown.mine === value}
      disabled={pending}
      onClick={() => vote(value)}
      title={names.length ? names.join(", ") : undefined}
      className={`pressable inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-meta font-semibold ${
        shown.mine === value
          ? value === 1
            ? "border-positive bg-positive text-panel"
            : "border-negative bg-negative text-panel"
          : "border-control text-ink hover:bg-raised"
      }`}
    >
      {label} <span className="tabular-nums">{names.length}</span>
    </button>
  );

  const voters = [
    shown.up.length ? `For: ${shown.up.join(", ")}` : null,
    shown.down.length ? `Against: ${shown.down.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Your vote" className="flex gap-2">
        {button(1, "For", shown.up)}
        {button(-1, "Against", shown.down)}
      </div>
      {voters ? <span className="text-meta text-muted">{voters}</span> : null}
    </div>
  );
}
