import type { Hue } from "@/lib/hues";

/**
 * The parts of the plane, and the section of Voyager each one opens. This is the one list the 3D
 * plane, the drawn cutaway, the manifest and the navigation all read, so they cannot disagree.
 */
export const PLANE_SECTION_IDS = ["cockpit", "cabin", "galley", "wing", "fin", "hold"] as const;
export type PlaneSectionId = (typeof PLANE_SECTION_IDS)[number];

export type Vec3 = readonly [number, number, number];

/** Where the camera sits, as an orbit around a point on the plane. Angles are in radians. */
export type Pose = {
  /** 0 looks at the nose head-on; a quarter turn looks at the right-hand side. */
  azimuth: number;
  elevation: number;
  /** Distance as a multiple of the distance that fits the whole plane in view. */
  zoom: number;
  target: Vec3;
};

export type PlaneSection = {
  id: PlaneSectionId;
  /** The part of the aircraft, as printed on the pass. */
  part: string;
  /** The section of Voyager it opens. */
  feature: string;
  href: string;
  hue: Hue;
  /** One line on what happens there. */
  line: string;
  /** Three-letter code in the style of an airport code. */
  code: string;
  /** The point on the plane the marker is pinned to (metres; nose towards +x, up +y). */
  anchor: Vec3;
  /** True when the anchor should follow whichever side of the plane faces the camera. */
  mirrored: boolean;
  /** The camera's view of this part while it is pointed at from the list. */
  view: Pose;
  /** Where the camera ends up when the traveller steps inside. */
  enter: Pose;
  /** The marker's place on the drawn cutaway, as percentages of its width and height. */
  flat: { x: number; y: number };
};

export const PLANE_SECTIONS: readonly PlaneSection[] = [
  {
    id: "cockpit",
    part: "Cockpit",
    feature: "Trips",
    href: "/trips",
    hue: "cobalt",
    line: "Set the flight plan. Compose turns your saved places into day-by-day trips.",
    code: "TRP",
    anchor: [15.4, 1.5, 0],
    mirrored: false,
    view: { azimuth: 0.55, elevation: 0.2, zoom: 0.62, target: [11, 0.6, 0] },
    enter: { azimuth: 0.32, elevation: 0.14, zoom: 0.16, target: [14.6, 0.9, 0] },
    flat: { x: 88.5, y: 44 },
  },
  {
    id: "cabin",
    part: "Main cabin",
    feature: "Huddle",
    href: "/huddle",
    hue: "sea",
    line: "Seats for your crew. Plan a trip together, live.",
    code: "HDL",
    anchor: [3.5, 2.3, 0],
    mirrored: false,
    view: { azimuth: 1.35, elevation: 0.3, zoom: 0.66, target: [3, 0.4, 0] },
    enter: { azimuth: 1.45, elevation: 0.2, zoom: 0.17, target: [3.5, 0.5, 0] },
    flat: { x: 55, y: 38 },
  },
  {
    id: "galley",
    part: "Rear galley",
    feature: "Travel DNA",
    href: "/dna",
    hue: "rose",
    line: "What you like to be served. Your tastes, pace and budget.",
    code: "DNA",
    anchor: [-8.6, 2.5, 0],
    mirrored: false,
    view: { azimuth: 2.25, elevation: 0.26, zoom: 0.62, target: [-8, 1, 0] },
    enter: { azimuth: 2.0, elevation: 0.2, zoom: 0.16, target: [-8.5, 1.1, 0] },
    flat: { x: 27.5, y: 38 },
  },
  {
    id: "wing",
    part: "Wing",
    feature: "Drift",
    href: "/drift",
    hue: "vermilion",
    line: "Ride the air. Swipe through places picked for you.",
    code: "DFT",
    anchor: [-2.6, 0.1, 10.5],
    mirrored: true,
    view: { azimuth: 1.15, elevation: 0.55, zoom: 0.7, target: [-1, -0.4, 6] },
    enter: { azimuth: 1.25, elevation: 0.5, zoom: 0.2, target: [-2.5, 0, 10] },
    flat: { x: 47, y: 71 },
  },
  {
    id: "fin",
    part: "Tail fin",
    feature: "Atlas",
    href: "/atlas",
    hue: "moss",
    line: "Your livery. A world map of everywhere you've been.",
    code: "ATL",
    anchor: [-14.4, 6.6, 0],
    mirrored: false,
    view: { azimuth: 2.5, elevation: 0.18, zoom: 0.62, target: [-13, 3.6, 0] },
    enter: { azimuth: 2.3, elevation: 0.12, zoom: 0.18, target: [-14.2, 5.6, 0] },
    flat: { x: 15.5, y: 22 },
  },
  {
    id: "hold",
    part: "Hold",
    feature: "Field Notes",
    href: "/notes",
    hue: "saffron",
    line: "What travellers brought back. Stories, tips and trips to fork.",
    code: "FLD",
    anchor: [8.4, -1.2, 1.75],
    mirrored: true,
    view: { azimuth: 1.1, elevation: -0.02, zoom: 0.6, target: [8, -0.8, 0] },
    enter: { azimuth: 1.2, elevation: -0.03, zoom: 0.16, target: [8.4, -1, 1] },
    flat: { x: 73, y: 57 },
  },
];

export function findSection(id: string | null | undefined): PlaneSection | null {
  return PLANE_SECTIONS.find((section) => section.id === id) ?? null;
}

/** The part of the plane a page belongs to, so each screen can wear its section's details. */
export function sectionForPath(pathname: string): PlaneSection | null {
  return (
    PLANE_SECTIONS.find(
      (section) => pathname === section.href || pathname.startsWith(`${section.href}/`),
    ) ?? null
  );
}

/** The view the plane rests in: front three-quarter, slightly above. */
export const HOME_POSE: Pose = { azimuth: 0.95, elevation: 0.13, zoom: 1, target: [0, 1.6, 0] };
