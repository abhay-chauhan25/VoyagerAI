import Image from "next/image";
import Link from "next/link";
import { dayHue, hueStyle, nameHue } from "@/lib/hues";
import type { TripSummary } from "@/lib/trips/queries";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function tripDates(startDate: string, dayCount: number): string {
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + dayCount - 1));
  return dayCount === 1
    ? dateFormat.format(start)
    : `${dateFormat.format(start)} – ${dateFormat.format(end)}`;
}

/**
 * A trip as a postcard: its first stop's photo (or its city's name on the city's own colour), the
 * name, and a strip of its days in their colours.
 */
export function TripCard({ trip }: { trip: TripSummary }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group pressable flex flex-col overflow-hidden rounded-card bg-panel focus-visible:outline-offset-4"
    >
      <div
        style={hueStyle(nameHue(trip.cityName))}
        className="hue-fill relative aspect-[16/9] overflow-hidden"
      >
        {trip.cover ? (
          <Image
            src={trip.cover.url}
            unoptimized
            alt=""
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-[var(--ease-out)] motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute bottom-3 left-4 font-display text-[2rem] leading-none font-extrabold uppercase">
            {trip.cityName}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
        <div className="flex flex-col">
          <h3 className="text-body leading-snug font-semibold">{trip.title}</h3>
          <p className="text-meta text-muted">
            {trip.cityName} · {tripDates(trip.startDate, trip.dayCount)} · {trip.stopCount}{" "}
            {trip.stopCount === 1 ? "stop" : "stops"}
          </p>
        </div>
        <div className="flex gap-1" aria-label={`${trip.dayCount} days`}>
          {Array.from({ length: trip.dayCount }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={hueStyle(dayHue(i))}
              className="hue-mark h-1.5 flex-1 rounded-full"
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
