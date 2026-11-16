"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANE_SECTIONS, findSection, type PlaneSectionId } from "@/lib/boarding/sections";
import { hueStyle } from "@/lib/hues";
import { useBoarding } from "./boarding";
import { PlaneStage } from "./plane-stage";
import { usePlaneStage } from "./use-plane-stage";

/**
 * The plane as the way around Voyager: the aircraft above, and below it the manifest, one pass for
 * each part. Pointing at either lights the other, so the two always agree about where a part leads.
 */
export function BoardDeck({ name }: { name: string }) {
  const stage = usePlaneStage();
  const { entering, board } = useBoarding();
  const [onPlane, setOnPlane] = useState<PlaneSectionId | null>(null);
  const [onList, setOnList] = useState<PlaneSectionId | null>(null);
  const active = findSection(entering?.id ?? onPlane ?? onList);
  const live = stage.stage === "live";

  return (
    <div className="flex min-h-[calc(100svh-6.5rem)] flex-col lg:min-h-svh">
      <div className="relative flex min-h-[20rem] flex-1 basis-[46svh]">
        <PlaneStage
          stage={stage}
          pointed={onList}
          entering={entering?.id ?? null}
          onPoint={setOnPlane}
          onChoose={board}
          links
          className="min-h-full w-full"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 px-5 pt-6 text-white sm:px-8 lg:pt-9">
          <h1 className="font-display text-[2rem] leading-[1.05] font-medium [text-shadow:0_1px_18px_rgb(10_16_40/0.45)] sm:text-[2.75rem]">
            Where to, {name}?
          </h1>
          <p
            className="max-w-[44ch] text-ui [text-shadow:0_1px_10px_rgb(10_16_40/0.6)] sm:text-body"
            aria-live="off"
          >
            {active
              ? active.line
              : live
                ? "Drag to look around the plane. Each part opens a part of Voyager."
                : "Each part of the plane opens a part of Voyager."}
          </p>
        </div>
        {stage.capable ? (
          <div
            role="group"
            aria-label="How the plane is shown"
            className="absolute right-4 bottom-4 flex rounded-control bg-panel p-0.5 text-meta shadow-[0_4px_16px_-6px_rgb(10_16_40/0.5)]"
          >
            {(["live", "drawn"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={stage.stage === option}
                onClick={() => stage.choose(option)}
                className={`pressable min-h-8 rounded-[4px] px-3 ${
                  stage.stage === option ? "bg-active font-semibold text-ink" : "text-muted"
                }`}
              >
                {option === "live" ? "3D" : "Drawing"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav
        aria-label="Manifest"
        className="border-t border-rule bg-ground px-4 py-4 sm:px-8 lg:py-5"
      >
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {PLANE_SECTIONS.map((section) => (
            <li key={section.id}>
              <Link
                href={section.href}
                style={hueStyle(section.hue)}
                data-active={active?.id === section.id}
                onPointerEnter={() => setOnList(section.id)}
                onPointerLeave={() => setOnList(null)}
                onFocus={() => setOnList(section.id)}
                onBlur={() => setOnList(null)}
                className="pass min-h-16"
              >
                <span className="pass-stub">{section.code}</span>
                <span className="flex min-w-0 flex-col justify-center px-4 py-2.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-body font-semibold">{section.feature}</span>
                    <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-muted uppercase">
                      {section.part}
                    </span>
                  </span>
                  <span className="text-meta text-muted">{section.line}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
