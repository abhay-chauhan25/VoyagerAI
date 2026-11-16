import Link from "next/link";
import { BriefDemo } from "@/components/landing/brief-demo";
import { PictureCredits } from "@/components/credits/picture-credits";
import { FirstTripCta } from "@/components/landing/first-trip-cta";
import { Flight } from "@/components/landing/flight";
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

      <Flight signedIn={signedIn} />

      {/* Back on the ground: the reading column beside a picture of the place. */}
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        <div className="h-[46svh] overflow-hidden rounded-card lg:sticky lg:top-3 lg:order-2 lg:h-[calc(100svh-1.5rem)]">
          <HeroStage />
        </div>
        <section
          aria-labelledby="intro-heading"
          className="flex flex-col justify-center px-4 py-20 sm:px-8 lg:order-1 lg:min-h-[calc(100svh-1.5rem)] lg:px-[12%]"
        >
          <h2
            id="intro-heading"
            {...reveal(0)}
            className="max-w-[16ch] font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-medium"
          >
            A travel companion, not a spreadsheet
          </h2>
          <div className="mt-8 flex max-w-[46ch] flex-col gap-5 text-body">
            <p {...reveal(1)} className="font-semibold">
              Most trips are planned in five tabs, a group chat and a note nobody can find. Voyager
              keeps all of it in one place that understands where things are.
            </p>
            <p {...reveal(2)}>
              Tell it what you like, or just swipe. It learns your pace, your budget and the kind of
              day you enjoy.
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
