import { AtlasIcon, DriftIcon, NotesIcon, TripsIcon } from "./icons";

export const NAV_ITEMS = [
  { href: "/drift", label: "Drift", Icon: DriftIcon },
  { href: "/trips", label: "Trips", Icon: TripsIcon },
  { href: "/atlas", label: "Atlas", Icon: AtlasIcon },
  { href: "/notes", label: "Field Notes", Icon: NotesIcon },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
