"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useRef, useState } from "react";
import type { Reaction } from "@/lib/dna/score";
import { useReducedMotion } from "@/components/landing/use-reduced-motion";

export type DeckScene = { id: string; title: string; photo: StaticImageData; alt: string };

/** Distance (px) or speed (px/ms) that commits a swipe; a quick flick is enough. */
const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 0.11;
const EXIT_MS = 220;

const REACTION_LABEL: Record<Reaction, string> = {
  pass: "Not for me",
  love: "Love it",
  more: "More like this",
};

function intentFor(dx: number, dy: number, vx: number, vy: number): Reaction | null {
  if (-dy > COMMIT_DISTANCE || (-vy > COMMIT_VELOCITY && -dy > Math.abs(dx))) return "more";
  if (dx > COMMIT_DISTANCE || (vx > COMMIT_VELOCITY && dx > 0)) return "love";
  if (dx < -COMMIT_DISTANCE || (-vx > COMMIT_VELOCITY && dx < 0)) return "pass";
  return null;
}

const EXIT_TRANSFORM: Record<Reaction, string> = {
  love: "translate(140%, 0) rotate(18deg)",
  pass: "translate(-140%, 0) rotate(-18deg)",
  more: "translate(0, -130%)",
};

type Props = {
  scenes: readonly DeckScene[];
  answers: Readonly<Record<string, Reaction>>;
  onAnswer: (sceneId: string, reaction: Reaction) => void;
  onUndo: () => void;
};

/**
 * The swipe deck. Drag the top card right to love it, left to pass, up for more like it; or use
 * the buttons or arrow keys. Dragging moves the card directly (no React render per frame).
 */
export function SceneDeck({ scenes, answers, onAnswer, onUndo }: Props) {
  const reduced = useReducedMotion();
  const index = scenes.findIndex((scene) => !answers[scene.id]);
  const current = index === -1 ? undefined : scenes[index];
  const next = index === -1 ? undefined : scenes[index + 1];
  const answeredCount = Object.keys(answers).length;

  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const [leaving, setLeaving] = useState<Reaction | null>(null);
  const [hint, setHint] = useState<Reaction | null>(null);

  const commit = useCallback(
    (reaction: Reaction) => {
      if (!current || leaving) return;
      if (reduced) {
        onAnswer(current.id, reaction);
        return;
      }
      setLeaving(reaction);
      const card = cardRef.current;
      if (card) {
        card.style.transition = `transform ${EXIT_MS}ms var(--ease-out), opacity ${EXIT_MS}ms ease`;
        card.style.transform = EXIT_TRANSFORM[reaction];
        card.style.opacity = "0";
      }
      window.setTimeout(() => {
        setLeaving(null);
        setHint(null);
        onAnswer(current.id, reaction);
      }, EXIT_MS);
    },
    [current, leaving, onAnswer, reduced],
  );

  const resetCard = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "transform 360ms var(--ease-drawer)";
    card.style.transform = "";
    setHint(null);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || leaving || event.button !== 0) return; // ignore second fingers
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
    const dy = Math.min(0, event.clientY - start.y) + Math.max(0, event.clientY - start.y) * 0.25; // resist dragging down
    cardRef.current.style.transform = reduced
      ? ""
      : `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`;
    setHint(intentFor(dx, dy, 0, 0));
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

  if (!current) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full max-w-[24rem] items-center justify-between text-ui">
        <span className="text-muted tabular-nums" aria-live="polite">
          {answeredCount + 1} of {scenes.length}
        </span>
        <button
          type="button"
          onClick={onUndo}
          disabled={answeredCount === 0 || leaving !== null}
          className="pressable min-h-10 text-muted underline-offset-4 hover:text-ink hover:underline disabled:invisible"
        >
          Back
        </button>
      </div>

      <div
        role="group"
        aria-roledescription="card deck"
        aria-label={`Scene ${answeredCount + 1} of ${scenes.length}: ${current.title}. Left arrow: not for me. Right arrow: love it. Up arrow: more like this.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative aspect-[3/4.4] w-full max-w-[24rem] rounded-card focus-visible:outline-offset-4"
      >
        {next ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-y-3 scale-[0.96] overflow-hidden rounded-card bg-panel"
          >
            <Image
              src={next.photo}
              alt=""
              fill
              sizes="24rem"
              className="object-cover"
              placeholder="blur"
            />
          </div>
        ) : null}
        <div
          ref={cardRef}
          key={current.id}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={resetCard}
          className="absolute inset-0 flex cursor-grab touch-none flex-col overflow-hidden rounded-card border border-border bg-panel select-none active:cursor-grabbing"
        >
          <div className="relative flex-1">
            <Image
              src={current.photo}
              alt={current.alt}
              fill
              priority
              draggable={false}
              sizes="(min-width: 640px) 24rem, 92vw"
              className="pointer-events-none object-cover"
              placeholder="blur"
            />
            {hint ? (
              <span className="absolute top-4 left-4 rounded-control bg-panel px-3 py-1.5 text-ui font-semibold text-ink">
                {REACTION_LABEL[hint]}
              </span>
            ) : null}
          </div>
          <p className="px-5 py-4 text-lead font-semibold">{current.title}</p>
        </div>
      </div>

      <div className="grid w-full max-w-[24rem] grid-cols-3 gap-2">
        {(["pass", "more", "love"] as const).map((reaction) => (
          <button
            key={reaction}
            type="button"
            onClick={() => commit(reaction)}
            disabled={leaving !== null}
            className={`pressable min-h-12 rounded-control px-2 text-ui font-semibold ${
              reaction === "love"
                ? "bg-primary text-primary-ink hover:bg-primary-hover"
                : "border border-control bg-panel text-ink hover:bg-raised"
            }`}
          >
            {REACTION_LABEL[reaction]}
          </button>
        ))}
      </div>
    </div>
  );
}
