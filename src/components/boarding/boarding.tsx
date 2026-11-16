"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PlaneSection } from "@/lib/boarding/sections";
import { hueStyle } from "@/lib/hues";

type Boarding = {
  /** The part being stepped into, while the camera is closing in on it. */
  entering: PlaneSection | null;
  /** Opens a part's section. With `fly`, the camera goes in first; without, it opens at once. */
  board: (section: PlaneSection, fly: boolean) => void;
};

const BoardingContext = createContext<Boarding>({ entering: null, board: () => {} });

export function useBoarding(): Boarding {
  return useContext(BoardingContext);
}

/** How long the camera flies before the section opens. */
const FLIGHT_MS = 780;

/**
 * Carries a traveller from the plane into a section. It lives above the pages, so the cover that
 * fades in as the camera reaches the plane is still there when the new page arrives underneath it,
 * and the two read as one movement.
 */
export function BoardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [entering, setEntering] = useState<PlaneSection | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const board = useCallback(
    (section: PlaneSection, fly: boolean) => {
      window.clearTimeout(timer.current);
      if (!fly) {
        router.push(section.href);
        return;
      }
      router.prefetch(section.href);
      setEntering(section);
      setFrom(pathname);
      timer.current = window.setTimeout(() => router.push(section.href), FLIGHT_MS);
    },
    [router, pathname],
  );

  // The cover lifts once the new page is in place.
  const arrived = entering !== null && from !== null && pathname !== from;
  useEffect(() => {
    if (!arrived) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntering(null);
    setFrom(null);
  }, [arrived]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ entering, board }), [entering, board]);

  return (
    <BoardingContext.Provider value={value}>
      {children}
      <div
        aria-hidden="true"
        data-open={entering ? "true" : "false"}
        style={entering ? hueStyle(entering.hue) : undefined}
        className="boarding-cover"
      >
        {entering ? (
          <span className="flex flex-col items-center gap-2">
            <span className="font-mono text-meta tracking-[0.18em] text-muted uppercase">
              {entering.part} · {entering.code}
            </span>
            <span className="font-display text-[2rem] leading-none">{entering.feature}</span>
            <span className="hue-mark h-0.5 w-16" />
          </span>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {entering ? `Opening ${entering.feature}` : ""}
      </p>
    </BoardingContext.Provider>
  );
}
