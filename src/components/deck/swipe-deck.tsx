"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import type { Reaction } from "@/lib/dna/score";
import { useReducedMotion } from "@/components/landing/use-reduced-motion";

/** Distance (px) or speed (px/ms) that commits a swipe; a quick flick is enough. */
const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 0.11;
const EXIT_MS = 220;

export const DEFAULT_LABELS: Record<Reaction, string> = {
  pass: "Not for me",
  love: "Love it",
  more: "More like this",
};

/** The reaction a drag is heading towards, before it is far enough to commit. */
function hintFor(dx: number, dy: number): Reaction {
  if (-dy > Math.abs(dx)) return "more";
  return dx >= 0 ? "love" : "pass";
}

export function intentFor(dx: number, dy: number, vx: number, vy: number): Reaction | null {
  if (-dy > COMMIT_DISTANCE || (-vy > COMMIT_VELOCITY && -dy > Math.abs(dx))) return "more";
  if (dx > COMMIT_DISTANCE || (vx > COMMIT_VELOCITY && dx > 0)) return "love";
  if (dx < -COMMIT_DISTANCE || (-vx > COMMIT_VELOCITY && dx < 0)) return "pass";
  return null;
}

/** How far a drag has gone towards committing, 0 to 1. Drives the peek card and the hint stamp. */
function dragProgress(dx: number, dy: number): number {
  return Math.min(1, Math.hypot(dx, dy) / COMMIT_DISTANCE);
}

const HINT_STYLE: Record<Reaction, string> = {
  love: "bg-positive text-panel",
  pass: "bg-ink text-panel",
  more: "bg-accent text-accent-ink",
};

const EXIT_TRANSFORM: Record<Reaction, string> = {
  love: "translate(140%, 0) rotate(18deg)",
  pass: "translate(-140%, 0) rotate(-18deg)",
  more: "translate(0, -130%)",
};

type Props<T> = {
  /** Cards still to judge; the first is on top. */
  items: readonly T[];
  keyOf: (item: T) => string;
  describe: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  renderPeek?: (item: T) => ReactNode;
  onAnswer: (item: T, reaction: Reaction) => void;
  progress?: string;
  onUndo?: () => void;
  canUndo?: boolean;
  labels?: Record<Reaction, string>;
  disabled?: boolean;
};

/**
 * A swipe deck. Drag the top card right to love it, left to pass, up for more like it; or use the
 * buttons or arrow keys. Dragging moves the card directly (no React render per frame).
 */
export function SwipeDeck<T>({
  items,
  keyOf,
  describe,
  renderCard,
  renderPeek,
  onAnswer,
  progress,
  onUndo,
  canUndo = false,
  labels = DEFAULT_LABELS,
  disabled = false,
}: Props<T>) {
  const reduced = useReducedMotion();
  const current = items[0];
  const next = items[1];

  const cardRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const [leaving, setLeaving] = useState<Reaction | null>(null);
  const [hint, setHint] = useState<Reaction | null>(null);
  const busy = leaving !== null || disabled;

  const commit = useCallback(
    (reaction: Reaction) => {
      if (current === undefined || busy) return;
      if (reduced) {
        onAnswer(current, reaction);
        return;
      }
      setLeaving(reaction);
      const card = cardRef.current;
      if (card) {
        card.style.transition = `transform ${EXIT_MS}ms var(--ease-out), opacity ${EXIT_MS}ms ease`;
        card.style.transform = EXIT_TRANSFORM[reaction];
        card.style.opacity = "0";
      }
      setPeek(1, EXIT_MS);
      window.setTimeout(() => {
        setLeaving(null);
        setHint(null);
        onAnswer(current, reaction);
        // The next card underneath starts from its resting place again.
        setPeek(0);
      }, EXIT_MS);
    },
    [current, busy, onAnswer, reduced],
  );

  /** The card underneath rises to meet the top card as it is dragged away. */
  function setPeek(progress: number, ms = 0) {
    const peek = peekRef.current;
    if (!peek) return;
    peek.style.transition = ms ? `transform ${ms}ms var(--ease-out)` : "none";
    peek.style.transform = `translateY(${12 * (1 - progress)}px) scale(${0.96 + 0.04 * progress})`;
  }

  const resetCard = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "transform 360ms var(--ease-drawer)";
    card.style.transform = "";
    if (hintRef.current) hintRef.current.style.opacity = "0";
    setPeek(0, 360);
    setHint(null);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || busy || event.button !== 0) return;
    // Links and buttons inside a card keep working; only the card surface starts a drag.
    if ((event.target as HTMLElement).closest("a, button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
    };
    if (cardRef.current) cardRef.current.style.transition = "none";
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !cardRef.current) return;
    const dx = event.clientX - start.x;
    const raw = event.clientY - start.y;
    const dy = Math.min(0, raw) + Math.max(0, raw) * 0.25; // resist dragging down
    cardRef.current.style.transform = reduced
      ? ""
      : `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`;
    const progress = dragProgress(dx, dy);
    if (!reduced) setPeek(progress);
    // The stamp fades in with the drag, so the decision is visible before it is made.
    if (hintRef.current) hintRef.current.style.opacity = String(Math.min(1, progress * 1.4));
    setHint(intentFor(dx, dy, 0, 0) ?? (progress > 0.35 ? hintFor(dx, dy) : null));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    const elapsed = Math.max(1, performance.now() - start.t);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const reaction = intentFor(dx, dy, dx / elapsed, dy / elapsed);
    if (reaction && (Math.abs(dx) > 24 || Math.abs(dy) > 24)) commit(reaction);
    else resetCard();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, Reaction> = {
      ArrowLeft: "pass",
      ArrowRight: "love",
      ArrowUp: "more",
    };
    const reaction = keys[event.key];
    if (reaction) {
      event.preventDefault();
      commit(reaction);
    }
  };

  if (current === undefined) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {progress || onUndo ? (
        <div className="flex w-full max-w-[24rem] items-center justify-between text-ui">
          <span className="text-muted tabular-nums" aria-live="polite">
            {progress}
          </span>
          {onUndo ? (
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo || busy}
              className="pressable min-h-10 text-muted underline-offset-4 hover:text-ink hover:underline disabled:invisible"
            >
              Back
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        role="group"
        aria-roledescription="card deck"
        aria-label={`${describe(current)}. Left arrow: ${labels.pass.toLowerCase()}. Right arrow: ${labels.love.toLowerCase()}. Up arrow: ${labels.more.toLowerCase()}.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative aspect-[3/4.4] w-full max-w-[24rem] rounded-card focus-visible:outline-offset-4"
      >
        {next !== undefined && renderPeek ? (
          <div
            ref={peekRef}
            aria-hidden="true"
            style={{ transform: "translateY(12px) scale(0.96)" }}
            className="absolute inset-0 overflow-hidden rounded-card bg-panel"
          >
            {renderPeek(next)}
          </div>
        ) : null}
        <div
          ref={cardRef}
          key={keyOf(current)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={resetCard}
          style={{ transformOrigin: "50% 110%" }}
          className="absolute inset-0 flex cursor-grab touch-none flex-col overflow-hidden rounded-card border border-border bg-panel select-none active:cursor-grabbing"
        >
          {renderCard(current)}
          <span
            ref={hintRef}
            aria-hidden="true"
            style={{ opacity: 0 }}
            className={`pointer-events-none absolute top-4 left-4 rounded-control px-3 py-1.5 text-ui font-semibold ${
              hint ? HINT_STYLE[hint] : "invisible"
            }`}
          >
            {hint ? labels[hint] : ""}
          </span>
        </div>
      </div>

      <div className="grid w-full max-w-[24rem] grid-cols-3 gap-2">
        {(["pass", "more", "love"] as const).map((reaction) => (
          <button
            key={reaction}
            type="button"
            onClick={() => commit(reaction)}
            disabled={busy}
            className={`pressable min-h-12 rounded-control px-2 text-ui font-semibold disabled:opacity-60 ${
              reaction === "love"
                ? "bg-primary text-primary-ink hover:bg-primary-hover"
                : "border border-control bg-panel text-ink hover:bg-raised"
            }`}
          >
            {labels[reaction]}
          </button>
        ))}
      </div>
    </div>
  );
}
