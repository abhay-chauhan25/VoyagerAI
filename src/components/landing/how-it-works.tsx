"use client";

import { useEffect, useRef, useState } from "react";
import { DayPlanFragment, DriftCardFragment, GroupVoteFragment } from "./fragments";

const STEPS = [
  {
    title: "Swipe what pulls at you.",
    detail: "Drift deals places picked for your taste, and says why each one is there.",
    Fragment: DriftCardFragment,
  },
  {
    title: "Then Compose lays out the days.",
    detail: "Saves become a plan that respects opening hours, walking time and your pace.",
    Fragment: DayPlanFragment,
  },
  {
    title: "Settle the rest together.",
    detail: "Friends vote on the open questions, and the plan follows the group.",
    Fragment: GroupVoteFragment,
  },
] as const;

/**
 * Pinned fragment, changing state: three statements scroll past a sticky stage, and the stage shows
 * the interface for whichever statement is nearest the middle of the screen.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.step);
            if (Number.isInteger(index)) setActive(index);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const node of refs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how" aria-labelledby="how-heading" className="px-5 sm:px-10 lg:px-16">
      <div className="grid gap-x-8 md:grid-cols-12 lg:gap-x-16">
        <div className="md:col-span-5">
          <h2 id="how-heading" data-reveal className="pt-24 text-[1.75rem] font-semibold lg:pt-32">
            How a trip comes together
          </h2>
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              ref={(node) => {
                refs.current[index] = node;
              }}
              data-step={index}
              className="flex min-h-[60svh] flex-col justify-center gap-3 md:min-h-[80svh]"
            >
              <p
                className={`text-[1.375rem] leading-snug font-semibold transition-colors duration-300 lg:text-[1.75rem] ${
                  active === index ? "text-ink" : "text-muted"
                }`}
              >
                {step.title}
              </p>
              <p className="max-w-[40ch] text-body text-muted">{step.detail}</p>
              {/* On phones the matching fragment sits under its statement instead of a pinned stage. */}
              <div className="pt-4 md:hidden">
                <step.Fragment />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:col-span-7 md:block">
          <div className="sticky top-[14svh] flex h-[72svh] items-center justify-center bg-surface">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                aria-hidden={active !== index}
                className={`absolute flex w-full justify-center px-6 transition-[opacity,transform] duration-500 ease-[var(--ease-out)] ${
                  active === index
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-4 opacity-0"
                }`}
              >
                <step.Fragment />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
