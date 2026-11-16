"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PLANE_SECTIONS,
  findSection,
  type PlaneSection,
  type PlaneSectionId,
  type Pose,
} from "@/lib/boarding/sections";
import { HUES, hueStyle, resolveHue, type Hue } from "@/lib/hues";
import { Cutaway } from "./cutaway";
import { useNight } from "./use-night";
import type { PlaneStage as StageState } from "./use-plane-stage";
import { useReducedMotion } from "@/components/landing/use-reduced-motion";

const PlaneScene = dynamic(() => import("./plane-scene"), { ssr: false });

type Props = {
  stage: StageState;
  /** The part pointed at from outside the plane (the manifest, the tour). */
  pointed: PlaneSectionId | null;
  /** A camera pose to hold; overrides the view of the pointed part. */
  pose?: Pose | null;
  entering: PlaneSectionId | null;
  /** Called when a part is pointed at on the plane itself, or the pointer leaves it. */
  onPoint: (id: PlaneSectionId | null) => void;
  /** Called when a part is chosen. `fly` is false for keyboard choices, which open at once. */
  onChoose: (section: PlaneSection, fly: boolean) => void;
  /** Markers are links to each section when true; otherwise they only point. */
  links: boolean;
  steerable?: boolean;
  /** Slides the plane across the frame (fractions of width and height) to clear text over it. */
  shift?: readonly [number, number];
  className?: string;
};

function themeHues(): Record<Hue, string> {
  return Object.fromEntries(HUES.map((hue) => [hue, resolveHue(hue)])) as Record<Hue, string>;
}

/**
 * The plane and its markers. The drawn cutaway is always there first; where the device can run it,
 * the live 3D plane loads on top and takes over. Either way the same six markers sit on the same
 * six parts, and each is a real link a keyboard or screen reader can use.
 */
export function PlaneStage({
  stage,
  pointed,
  pose = null,
  entering,
  onPoint,
  onChoose,
  links,
  steerable = true,
  shift,
  className = "",
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const markers = useRef<Partial<Record<PlaneSectionId, HTMLElement | null>>>({});
  const [hovered, setHovered] = useState<PlaneSectionId | null>(null);
  const [live, setLive] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const night = useNight();
  const reduced = useReducedMotion();
  const wantLive = stage.stage === "live";
  const showLive = wantLive && live;

  // Colours are read from the page once the theme is known, and again when it changes.
  const hues = useMemo(() => themeHues(), [night]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? true),
    );
    observer.observe(element);
    const onVisibility = () => setOnScreen(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const point = useCallback(
    (id: PlaneSectionId | null) => {
      setHovered(id);
      onPoint(id);
    },
    [onPoint],
  );

  const active = entering ?? hovered ?? pointed;
  // Pointing at a part from the list turns the camera to it; pointing on the plane itself doesn't,
  // or the plane would slide out from under the pointer.
  const directed = pose ?? (hovered ? null : (findSection(pointed)?.view ?? null));

  return (
    <div
      ref={frame}
      className={`plane-sky relative isolate overflow-hidden ${className}`}
      style={{ "--plane-x": shift?.[0] ?? 0, "--plane-y": shift?.[1] ?? 0 } as React.CSSProperties}
    >
      <div
        className={`plane-flat transition-opacity duration-500 ease-out ${
          showLive ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <Cutaway active={active} />
      </div>

      {wantLive ? (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            live ? "opacity-100" : "opacity-0"
          }`}
        >
          <PlaneScene
            active={active}
            entering={entering}
            directed={directed}
            night={night}
            hues={hues}
            moving={!reduced}
            steerable={steerable}
            shift={shift}
            running={onScreen}
            startQuality={stage.quality}
            markers={markers}
            onHover={point}
            onPick={(id) => {
              const section = findSection(id);
              if (section) onChoose(section, !reduced);
            }}
            onReady={() => setLive(true)}
            onStruggle={() => stage.choose("drawn")}
          />
        </div>
      ) : null}

      <ul
        className={`pointer-events-none m-0 list-none p-0 ${showLive ? "absolute inset-0" : "plane-flat"}`}
        aria-label="Parts of the plane"
      >
        {PLANE_SECTIONS.map((section) => {
          const isActive = active === section.id;
          const label = (
            <>
              <span className="plane-pin hue-mark" data-active={isActive} />
              <span className="plane-tag" data-active={isActive}>
                <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
                  {section.part}
                </span>
                <span className="font-display text-lead leading-tight">{section.feature}</span>
              </span>
            </>
          );
          const shared = {
            className: "plane-marker pointer-events-auto",
            style: hueStyle(section.hue),
            onPointerEnter: () => point(section.id),
            onPointerLeave: () => point(null),
            onFocus: () => onPoint(section.id),
            onBlur: () => onPoint(null),
          };
          return (
            <li
              key={section.id}
              ref={(element) => {
                markers.current[section.id] = element;
              }}
              className="absolute top-0 left-0"
              style={
                showLive
                  ? undefined
                  : {
                      transform: "none",
                      visibility: "visible",
                      left: `${section.flat.x}%`,
                      top: `${section.flat.y}%`,
                    }
              }
            >
              {links ? (
                <a
                  {...shared}
                  href={section.href}
                  aria-label={`${section.feature}: ${section.part}`}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                    event.preventDefault();
                    // A click made from the keyboard has no pointer detail: open without the flight.
                    onChoose(section, event.detail > 0 && showLive && !reduced);
                  }}
                >
                  {label}
                </a>
              ) : (
                <button
                  {...shared}
                  type="button"
                  aria-label={`${section.feature}: ${section.part}`}
                  onClick={() => onChoose(section, false)}
                >
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
