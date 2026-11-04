import Image from "next/image";
import Link from "next/link";
import { countryName } from "@/lib/atlas/countries";
import type { Card } from "@/lib/drift/cards";
import { INTEREST_HUE, hueStyle, nameHue } from "@/lib/hues";
import type { Interest } from "@/lib/interests";
import type { Photo } from "@/lib/places/types";

function place(card: Card): string {
  if (card.kind === "activity") return `${card.category} · ${card.cityName}`;
  return [
    card.region && card.region !== card.name ? card.region : null,
    countryName(card.countryCode),
  ]
    .filter(Boolean)
    .join(", ");
}

/** Author and licence, as Commons licences require wherever the photo is shown. */
export function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <span>
      Photo:{" "}
      <a
        href={photo.page}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {photo.author}
      </a>
      ,{" "}
      {photo.licenseUrl ? (
        <a
          href={photo.licenseUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {photo.license}
        </a>
      ) : (
        photo.license
      )}
    </span>
  );
}

function Visual({ card, priority }: { card: Card; priority?: boolean }) {
  if (card.photo) {
    return (
      <Image
        src={card.photo.url}
        unoptimized
        alt={`${card.name}, ${place(card)}`}
        fill
        priority={priority}
        draggable={false}
        sizes="(min-width: 640px) 24rem, 92vw"
        className="pointer-events-none object-cover"
      />
    );
  }
  // No freely licensed photo exists for it: set the name in type on a field of the place's own
  // colour (stable per name) rather than show a stand-in picture.
  return (
    <div
      style={hueStyle(nameHue(card.name))}
      className="hue-fill flex h-full flex-col justify-end p-5"
    >
      <span className="font-display text-[2.5rem] leading-[0.9] font-extrabold break-words uppercase">
        {card.name}
      </span>
    </div>
  );
}

/** Interests as chips in their family's hue (food and drink, culture, city, night, outdoors, water). */
export function InterestChips({
  interests,
  label = "Matches your interests",
}: {
  interests: readonly Interest[];
  label?: string;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {interests.map((interest) => (
        <li
          key={interest}
          style={hueStyle(INTEREST_HUE[interest])}
          className="hue-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-meta"
        >
          <span aria-hidden="true" className="hue-mark size-1.5 rounded-full" />
          {interest}
        </li>
      ))}
    </ul>
  );
}

/** The face of a Drift card, used on top of the deck. */
export function DriftCardFace({ card, priority }: { card: Card; priority?: boolean }) {
  return (
    <>
      <div className="relative min-h-0 flex-[1.1]">
        <Visual card={card} priority={priority} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-5 pt-4 pb-3">
        <div className="flex flex-col">
          <h2 className="text-lead leading-tight font-semibold">{card.name}</h2>
          <p className="text-meta text-muted">{place(card)}</p>
        </div>
        <p className="text-ui">{card.why}</p>
        {card.interests.length > 0 ? <InterestChips interests={card.interests} /> : null}
        {card.kind === "destination" && card.blurb ? (
          <p className="line-clamp-2 text-meta text-muted">{card.blurb.text}</p>
        ) : null}
        {card.kind === "activity" && card.openingHours ? (
          <p className="text-meta text-muted">Hours: {card.openingHours}</p>
        ) : null}
        <p className="mt-auto flex flex-wrap gap-x-3 text-[0.75rem] leading-5 text-muted">
          {card.photo ? <PhotoCredit photo={card.photo} /> : null}
          {card.kind === "destination" && card.blurb ? (
            <span>
              Text:{" "}
              <a
                href={card.blurb.page}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {card.blurb.source}
              </a>{" "}
              (CC BY-SA)
            </span>
          ) : null}
          {card.kind === "activity" ? (
            <span>
              Data:{" "}
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {card.dataSource === "OpenStreetMap"
                  ? "© OpenStreetMap contributors"
                  : "Wikipedia (CC BY-SA)"}
              </a>
            </span>
          ) : null}
        </p>
      </div>
    </>
  );
}

export function DriftCardPeek({ card }: { card: Card }) {
  return <Visual card={card} />;
}

/** A compact row for search results and the saved list. */
export function DriftCardRow({ card, children }: { card: Card; children?: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3">
      <div
        style={hueStyle(nameHue(card.name))}
        className="hue-fill relative size-20 shrink-0 overflow-hidden rounded-control"
      >
        {card.photo ? (
          <Image
            src={card.photo.url}
            unoptimized
            alt=""
            fill
            sizes="5rem"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full items-end p-2 font-display text-[1.25rem] leading-none font-extrabold uppercase"
          >
            {card.name.slice(0, 2)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-ui font-semibold">{card.name}</h3>
          <span className="text-meta text-muted">{place(card)}</span>
        </div>
        <p className="text-meta">{card.why}</p>
        {card.photo ? (
          <p className="text-[0.75rem] text-muted">
            <PhotoCredit photo={card.photo} />
          </p>
        ) : null}
        {children ? <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">{children}</div> : null}
      </div>
    </div>
  );
}

export function ExploreLink({ cityId, name }: { cityId: number; name: string }) {
  return (
    <Link
      href={`/drift/${cityId}`}
      className="text-meta font-semibold underline underline-offset-4"
    >
      Explore places in {name}
    </Link>
  );
}
