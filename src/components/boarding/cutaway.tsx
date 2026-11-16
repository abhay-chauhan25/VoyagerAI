import { PLANE_SECTIONS, type PlaneSectionId } from "@/lib/boarding/sections";
import { hueVar } from "@/lib/hues";

const WINDOWS = Array.from({ length: 30 }, (_, i) => 346 + i * 15.6);
const GALLEY_WINDOWS = [262, 277.6, 293.2, 308.8];

/** A part's outline on the drawing, lit in its hue while that part is pointed at. */
function partShape(id: PlaneSectionId, hull: string): React.ReactNode {
  switch (id) {
    case "cockpit":
      return <rect x="822" y="150" width="140" height="100" clipPath={hull} />;
    case "cabin":
      return <rect x="330" y="150" width="492" height="100" clipPath={hull} />;
    case "galley":
      return <rect x="80" y="110" width="250" height="140" clipPath={hull} />;
    case "wing":
      return <path d="M566 226 430 334h-46l58-104Z" />;
    case "fin":
      return <path d="M268 168 176 46h-48l24 104 40 18Z" />;
    case "hold":
      return <rect x="700" y="212" width="60" height="19" rx="3" />;
  }
}

/**
 * The plane as a drawing: the same aircraft and the same parts as the live scene, for devices that
 * can't draw 3D smoothly, for reduced motion, and for the moment before the live scene has loaded.
 */
export function Cutaway({
  active,
  id = "cutaway",
}: {
  active: PlaneSectionId | null;
  /** Distinguishes this drawing's clip shapes when a page shows more than one. */
  id?: string;
}) {
  const hull = `url(#${id}-hull)`;
  return (
    <svg
      viewBox="0 0 1000 400"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}-hull`}>
          <path d="M958 204c-8-22-52-38-104-38H300c-70 0-142-14-204-28l-6 4 4 12c60 30 130 80 206 80h552c50 0 100-12 106-30Z" />
        </clipPath>
      </defs>

      {/* Far wing and tailplane, behind the body */}
      <path d="M520 172 452 108h-26l34 64Z" fill="var(--plane-shade)" />
      <path d="M190 150 128 126h-24l42 30Z" fill="var(--plane-shade)" />

      {/* Fin with its livery */}
      <path d="M268 168 176 46h-48l24 104 40 18Z" fill="var(--plane-dusk)" />
      <g clipPath={`url(#${id}-fin)`}>
        {["cobalt", "sea", "vermilion", "saffron", "rose", "moss"].map((hue, i) => (
          <rect
            key={hue}
            x="100"
            y={70 + i * 8}
            width="180"
            height="4.5"
            fill={`var(--hue-${hue})`}
          />
        ))}
      </g>
      <clipPath id={`${id}-fin`}>
        <path d="M268 168 176 46h-48l24 104 40 18Z" />
      </clipPath>

      {/* Body: paint above, dusk belly below, brass cheatline between */}
      <g clipPath={hull}>
        <rect x="80" y="100" width="900" height="160" fill="var(--plane-paint)" />
        <rect x="80" y="214" width="900" height="60" fill="var(--plane-dusk)" />
        <rect x="80" y="211" width="900" height="3" fill="var(--plane-brass)" />
      </g>
      <path d="M874 176h30l12 15h-46Z" fill="var(--plane-glass)" />
      {WINDOWS.map((x) => (
        <rect key={x} x={x} y="184" width="6" height="9" rx="3" fill="var(--plane-glass)" />
      ))}
      {GALLEY_WINDOWS.map((x) => (
        <rect key={x} x={x} y="183" width="6" height="9" rx="3" fill="var(--plane-glass)" />
      ))}
      <rect
        x="700"
        y="212"
        width="60"
        height="19"
        rx="3"
        fill="var(--plane-shade)"
        opacity="0.55"
      />

      {/* Near tailplane, wing and engine, in front of the body */}
      <path d="M196 174 120 160H96l54 22Z" fill="var(--plane-wing)" />
      <path d="M566 226 430 334h-46l58-104Z" fill="var(--plane-wing)" />
      <rect x="486" y="248" width="86" height="34" rx="17" fill="var(--plane-dusk)" />
      <rect x="560" y="252" width="10" height="26" rx="5" fill="var(--plane-glass)" />

      {/* The part being pointed at */}
      {PLANE_SECTIONS.map((section) => (
        <g
          key={section.id}
          fill={hueVar(section.hue)}
          className="transition-opacity duration-200 ease-out"
          opacity={active === section.id ? 0.55 : 0}
        >
          {partShape(section.id, hull)}
        </g>
      ))}
    </svg>
  );
}
