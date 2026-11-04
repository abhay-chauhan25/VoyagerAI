"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { STAGE_PHOTOS } from "./photos";
import { useReducedMotion } from "./use-reduced-motion";

const HOLD_MS = 5600;

/**
 * The fixed half of the page: three places in Lisbon crossfading slowly, like light shifting in a
 * room. Pauses while the tab is hidden; shows only the first photograph under reduced motion.
 */
export function HeroStage() {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      timer ??= setInterval(() => setIndex((i) => (i + 1) % STAGE_PHOTOS.length), HOLD_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  // Under reduced motion the first photograph stays put.
  const shown = reduced ? 0 : index;
  const current = STAGE_PHOTOS[shown] ?? STAGE_PHOTOS[0];

  return (
    <figure className="relative h-full w-full overflow-hidden bg-surface">
      {STAGE_PHOTOS.map((photo, i) => (
        <Image
          key={photo.place}
          src={photo.src}
          alt={i === shown ? photo.alt : ""}
          aria-hidden={i === shown ? undefined : true}
          fill
          priority={i === 0}
          sizes="(min-width: 1024px) 50vw, 100vw"
          placeholder="blur"
          className={`object-cover transition-[opacity,transform] duration-[1600ms] ease-[var(--ease-in-out)] ${
            i === shown ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
          }`}
        />
      ))}
      <figcaption
        aria-live="off"
        className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-between gap-4 bg-bg px-5 text-ui text-ink"
      >
        <span>{current.place}</span>
        <span className="text-muted tabular-nums">{current.coords}</span>
      </figcaption>
    </figure>
  );
}
