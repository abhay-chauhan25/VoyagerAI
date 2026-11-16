"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PlaneStage } from "@/components/boarding/plane-stage";
import { usePlaneStage } from "@/components/boarding/use-plane-stage";
import { Wordmark } from "@/components/brand/mark";
import { ButtonLink } from "@/components/ui/button";
import { PLANE_SECTIONS, type PlaneSectionId } from "@/lib/boarding/sections";
import { hueStyle } from "@/lib/hues";

/** What each part of the plane stands for, told to someone who hasn't signed up yet. */
const STORY: Record<PlaneSectionId, { heading: string; body: string; soon?: boolean }> = {
  cockpit: {
    heading: "Compose a trip",
    body: "Pick a city and your dates. Compose groups nearby places into days, checks opening hours and counts the walking time. Ask Compass to slow a day down or plan around rain, then accept only the changes you like.",
  },
  cabin: {
    heading: "Plan it together",
    body: "Invite friends by link or by handle. Everyone swipes the same places, votes on changes and sees edits as they happen. Consensus drafts a plan that gives each person something they picked.",
  },
  galley: {
    heading: "Tell it your taste",
    body: "Swipe through a deck of scenes instead of filling in a form. Voyager learns your interests, pace and budget, shows you why it thinks so, and lets you correct it.",
  },
  wing: {
    heading: "Find places worth saving",
    body: "A deck of real places, each with the reason it was dealt to you. Or ask in your own words: somewhere warm in March with great food.",
  },
  fin: {
    heading: "Keep your map",
    body: "Every place you've been fills in a world map. Keep it private, or share it as your profile.",
  },
  hold: {
    heading: "Bring stories back",
    body: "Reviews, photos and whole trips from other travellers, ready to copy into your own plan.",
    soon: true,
  },
};

/**
 * The top of the homepage: the plane in flight behind the headline, then a walk through it. The
 * plane stays pinned while the reader scrolls; each chapter turns the camera to its part and lights
 * it. Without 3D the drawn plane does the same job.
 */
export function Flight({ signedIn }: { signedIn: boolean }) {
  const stage = usePlaneStage();
  const chapters = useRef<Partial<Record<PlaneSectionId, HTMLElement | null>>>({});
  const [chapter, setChapter] = useState<PlaneSectionId | null>(null);
  const [onPlane, setOnPlane] = useState<PlaneSectionId | null>(null);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // The plane keeps clear of the words: below the headline, then beside or above each chapter.
  const shift: readonly [number, number] = chapter
    ? wide
      ? [0.14, 0]
      : [0, -0.2]
    : wide
      ? [0.05, 0.17]
      : [0, 0.2];

  useEffect(() => {
    // A chapter is current while it crosses the middle band of the window.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.part as PlaneSectionId;
          if (entry.isIntersecting) setChapter(id);
          else setChapter((current) => (current === id ? null : current));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const element of Object.values(chapters.current)) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pointedAt = PLANE_SECTIONS.find((section) => section.id === onPlane);

  return (
    <div className="relative">
      <div className="sticky top-0 h-svh">
        <PlaneStage
          stage={stage}
          pointed={chapter}
          entering={null}
          onPoint={setOnPlane}
          onChoose={(section) =>
            chapters.current[section.id]?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          links={false}
          shift={shift}
          className="h-full w-full"
        />
      </div>

      {/* Everything below scrolls over the pinned plane. */}
      <div className="pointer-events-none relative -mt-[100svh]">
        <section className="flex min-h-svh flex-col text-white">
          <nav
            aria-label="Site"
            className="pointer-events-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 pt-5 text-ui sm:px-10"
          >
            <a
              href="#how"
              className="justify-self-start whitespace-nowrap underline-offset-4 hover:underline"
            >
              How it works
            </a>
            <Link href="/" aria-label="Voyager home" className="rounded-control">
              <Wordmark />
            </Link>
            <Link
              href={signedIn ? "/board" : "/sign-in"}
              className="justify-self-end underline-offset-4 hover:underline"
            >
              {signedIn ? "Open Voyager" : "Sign in"}
            </Link>
          </nav>

          <div className="flex flex-1 flex-col justify-between px-5 pt-[9svh] pb-8 sm:px-10">
            <div className="flex max-w-[34rem] flex-col items-start [text-shadow:0_1px_24px_rgb(10_16_40/0.5)]">
              <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.98] font-medium tracking-[-0.015em]">
                Plan a trip that fits you
              </h1>
              <p className="mt-5 max-w-[40ch] text-lead">
                Voyager turns the places you save into a day-by-day trip on a map, and lets your
                friends plan it with you.
              </p>
              <div className="pointer-events-auto mt-7 [text-shadow:none]">
                <ButtonLink
                  href={signedIn ? "/board" : "/sign-up"}
                  size="lg"
                  className="bg-panel! text-ink! hover:bg-raised!"
                >
                  {signedIn ? "Board the plane" : "Start planning, free"}
                </ButtonLink>
              </div>
            </div>
            <p className="font-mono text-meta tracking-[0.14em] uppercase [text-shadow:0_1px_10px_rgb(10_16_40/0.6)]">
              {pointedAt
                ? `${pointedAt.part} · ${pointedAt.feature}`
                : "Scroll to walk through the plane"}
            </p>
          </div>
        </section>

        <section aria-labelledby="tour-heading" className="px-5 pb-[30svh] sm:px-10">
          <h2 id="tour-heading" className="sr-only">
            A walk through the plane
          </h2>
          <ol className="m-0 flex list-none flex-col p-0">
            {PLANE_SECTIONS.map((section) => {
              const story = STORY[section.id];
              return (
                <li
                  key={section.id}
                  data-part={section.id}
                  ref={(element) => {
                    chapters.current[section.id] = element;
                  }}
                  className="flex min-h-[88svh] items-end pb-[12svh] md:items-center md:pb-0"
                >
                  <article
                    style={hueStyle(section.hue)}
                    className="pointer-events-auto flex w-full max-w-[26rem] flex-col gap-3 rounded-card bg-panel p-6 text-ink shadow-[0_18px_50px_-18px_rgb(10_16_40/0.55)]"
                  >
                    <p className="flex items-center justify-between font-mono text-[0.75rem] tracking-[0.14em] uppercase">
                      <span className="hue-text">
                        {section.part} · {section.code}
                      </span>
                      {story.soon ? <span className="text-muted">Coming next</span> : null}
                    </p>
                    <h3 className="font-display text-[2rem] leading-[1.05] font-medium">
                      {story.heading}
                    </h3>
                    <p className="text-body">{story.body}</p>
                    <p className="flex items-center gap-2 text-ui text-muted">
                      <span className="hue-mark h-0.5 w-6" aria-hidden="true" />
                      {section.feature}
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
