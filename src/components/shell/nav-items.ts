import { AtlasIcon, DriftIcon, HuddleIcon, NotesIcon, PlaneIcon, TripsIcon } from "./icons";

/** `short` is the label used on the phone tab bar, where six tabs share the width. */
export const NAV_ITEMS = [
  { href: "/board", label: "The plane", short: "Plane", Icon: PlaneIcon },
  { href: "/drift", label: "Drift", short: "Drift", Icon: DriftIcon },
  { href: "/trips", label: "Trips", short: "Trips", Icon: TripsIcon },
  { href: "/huddle", label: "Huddle", short: "Huddle", Icon: HuddleIcon },
  { href: "/atlas", label: "Atlas", short: "Atlas", Icon: AtlasIcon },
  { href: "/notes", label: "Field Notes", short: "Notes", Icon: NotesIcon },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
