import { TRIP_IDEA_MAX_LENGTH } from "@/lib/auth/schemas";

/**
 * The page ends with the product's first screen already open: name a trip, and the name is carried
 * into sign-up. A plain GET form, so it works without script.
 */
export function FirstTripCta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="grid min-h-[90svh] gap-12 bg-accent px-5 py-16 text-accent-ink sm:px-10 lg:grid-cols-12 lg:px-16 lg:py-10"
    >
      <div
        className="flex flex-col justify-start gap-4 lg:col-span-5 lg:justify-end lg:pb-10"
        data-reveal
      >
        <h2
          id="cta-heading"
          className="font-display text-[13vw] leading-[0.92] font-extrabold uppercase sm:text-display"
        >
          Name your
          <br />
          first trip
        </h2>
        <p className="max-w-[40ch] text-lead">
          Create your account and the trip will be waiting on your Trips page, ready to plan.
        </p>
      </div>

      <div
        className="flex items-end lg:col-span-5 lg:col-start-7 lg:items-center"
        data-reveal
        style={{ "--reveal-index": 1 } as React.CSSProperties}
      >
        <form
          action="/sign-up"
          method="get"
          data-ui
          className="w-full max-w-[27.5rem] rounded-card bg-panel p-6 text-ink shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]" // taste-skill-ignore: a dialog floats, so it keeps its shadow
        >
          <h3 className="text-lead font-semibold">Name your first trip</h3>
          <p className="pt-1 text-ui text-muted">You can rename it any time.</p>
          <label htmlFor="cta-trip" className="mt-5 block text-ui font-semibold">
            Trip name
          </label>
          <input
            id="cta-trip"
            name="trip"
            defaultValue="Lisbon in May"
            maxLength={TRIP_IDEA_MAX_LENGTH}
            required
            className="mt-2 min-h-11 w-full rounded-control border border-control bg-panel px-3 text-body focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            className="pressable mt-5 min-h-[3.25rem] w-full rounded-control bg-primary text-body font-semibold text-primary-ink hover:bg-primary-hover"
          >
            Create account
          </button>
        </form>
      </div>
    </section>
  );
}
