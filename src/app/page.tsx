import Link from "next/link";
import { Wordmark } from "@/components/brand/mark";
import { ButtonLink } from "@/components/ui/button";
import { BriefDemo } from "@/components/landing/brief-demo";
import { PictureCredits } from "@/components/credits/picture-credits";
import { FirstTripCta } from "@/components/landing/first-trip-cta";
import { Gallery } from "@/components/landing/gallery";
import { HeroStage } from "@/components/landing/hero-stage";
import { HowItWorks } from "@/components/landing/how-it-works";
import { RevealOnScroll } from "@/components/landing/reveal";
import { createClient } from "@/lib/supabase/server";

const reveal = (index: number) => ({
  "data-reveal": true,
  style: { "--reveal-index": index } as React.CSSProperties,
});

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  return (
    <div className="bg-bg text-ink">
      <RevealOnScroll />

      {/* Split stage: the reading column scrolls past a fixed picture of the place. */}
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        <div className="sticky top-3 z-0 h-[40svh] lg:order-2 lg:h-[calc(100svh-1.5rem)]">
          <HeroStage />
        </div>

        <div className="relative z-10 flex flex-col bg-bg lg:order-1">
          <nav
            aria-label="Site"
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-2 pt-4 text-ui sm:px-6"
          >
            <a href="#how" className="justify-self-start underline-offset-4 hover:underline">
              How it works
            </a>
            <Link href="/" aria-label="Voyager home" className="rounded-control">
              <Wordmark />
            </Link>
            <Link
              href={signedIn ? "/trips" : "/sign-in"}
              className="justify-self-end underline-offset-4 hover:underline"
            >
              {signedIn ? "Open Voyager" : "Sign in"}
            </Link>
          </nav>

          <section className="flex flex-col items-center justify-start px-4 pt-10 pb-24 text-center sm:px-8 lg:min-h-[calc(100svh-6rem)] lg:pt-[30svh] lg:pb-[22svh]">
            <h1
              {...reveal(0)}
              className="max-w-[14ch] font-display text-[11vw] leading-[0.9] font-extrabold tracking-[-0.01em] text-accent uppercase sm:text-display"
            >
              Plan a trip that fits you
            </h1>
            <p {...reveal(1)} className="mt-6 max-w-[40ch] text-lead lg:mt-8">
              Voyager turns the places you save into a day-by-day trip on a map, and lets your
              friends plan it with you.
            </p>
            <div {...reveal(2)} className="mt-7 lg:mt-9">
              <ButtonLink
                href={signedIn ? "/trips" : "/sign-up"}
                variant="accent"
                size="lg"
                className="rounded-none"
              >
                {signedIn ? "Open your trips" : "Start planning, free"}
              </ButtonLink>
            </div>
          </section>

          <section
            aria-labelledby="intro-heading"
            className="px-4 pb-24 sm:px-8 lg:px-[12%] lg:pb-40"
          >
            <h2
              id="intro-heading"
              {...reveal(0)}
              className="max-w-[24ch] text-[1.75rem] leading-tight font-semibold"
            >
              A travel companion, not a spreadsheet
            </h2>
            <div className="mt-8 flex max-w-[46ch] flex-col gap-5 text-body">
              <p {...reveal(1)} className="font-semibold">
                Most trips are planned in five tabs, a group chat and a note nobody can find.
                Voyager keeps all of it in one place that understands where things are.
              </p>
              <p {...reveal(2)}>
                Tell it what you like, or just swipe. It learns your pace, your budget and the kind
                of day you enjoy.
              </p>
              <p {...reveal(3)}>
                When you&apos;re ready, it turns what you saved into days that make sense on a map:
                nearby places together, opening hours respected, walking time counted.
              </p>
              <p {...reveal(4)}>
                Plan alone or bring friends in. Everyone swipes, Voyager finds the overlap, and the
                plan settles without forty messages.
              </p>
            </div>
          </section>
        </div>
      </div>

      <section aria-labelledby="showcase-heading" className="relative">
        <h2 id="showcase-heading" className="sr-only">
          Your words, your trip
        </h2>
        <BriefDemo />
      </section>

      <HowItWorks />

      <div className="h-16 lg:h-28" aria-hidden="true" />
      <Gallery />

      <div className="h-16 lg:h-28" aria-hidden="true" />
      <FirstTripCta />

      <footer className="flex flex-col gap-6 px-5 pt-[16svh] pb-8 sm:px-10 lg:px-16 lg:pt-[24svh]">
        <PictureCredits />
        <div className="grid gap-2 text-ui lg:grid-cols-[1fr_auto_1fr] lg:items-baseline">
          <span className="text-muted">Voyager · trips planned together</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1">
            <a href="#how" className="hover:underline">
              How it works
            </a>
            <Link href="/sign-in" className="hover:underline">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:underline">
              Create account
            </Link>
          </nav>
          <span className="text-muted lg:justify-self-end">© 2026 Voyager</span>
        </div>
      </footer>
    </div>
  );
}
