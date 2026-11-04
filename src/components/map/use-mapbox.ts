"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Map as MapboxMap, MapOptions } from "mapbox-gl";

type MapboxModule = typeof import("mapbox-gl").default;

/** Mapbox Standard: full colour, 3D buildings, and a light preset that follows Voyager's theme. */
export const STANDARD_STYLE = "mapbox://styles/mapbox/standard";

/** Follows the page theme: an explicit data-theme wins, otherwise the system preference. */
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", onChange);
  };
}
export function currentTheme(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as const);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const lightPreset = (theme: "light" | "dark") => (theme === "dark" ? "night" : "day");

type Setup = (map: MapboxMap, mapboxgl: MapboxModule) => void;

/**
 * Creates a Mapbox map in the returned container once, in the browser only. `onStyleLoad` runs on
 * every style load to add Voyager's own layers. Switching Day/Night relights the same style (no
 * reload, no flash). Returns the live map (or null) and a failure message to show instead.
 */
export function useMapbox(
  token: string | undefined,
  options: Omit<MapOptions, "container" | "style">,
  onStyleLoad: Setup,
  onCreate?: Setup,
) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapboxMap | null>(null);
  // True once the style has loaded at least once; layers and markers can be added from then on.
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const theme = useTheme();
  // Callbacks and options are read once, at creation; later changes go through the returned map.
  const init = useRef({ options, onStyleLoad, onCreate });

  useEffect(() => {
    if (!token || !container.current) return;
    let cancelled = false;
    let created: MapboxMap | undefined;
    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled || !container.current) return;
        mapboxgl.accessToken = token;
        created = new mapboxgl.Map({
          ...init.current.options,
          container: container.current,
          style: STANDARD_STYLE,
          config: { basemap: { lightPreset: lightPreset(currentTheme()) } },
        });
        created.on("style.load", () => {
          if (!created) return;
          init.current.onStyleLoad(created, mapboxgl);
          setReady(true);
        });
        created.on("error", (event) => {
          // Mapbox reports a bad or restricted token as an error event, not an exception.
          const status = (event.error as { status?: number } | undefined)?.status;
          if (status === 401 || status === 403)
            setFailure("The map couldn't load: check the Mapbox token and its URL restrictions.");
        });
        init.current.onCreate?.(created, mapboxgl);
        setMap(created);
      })
      .catch(() => setFailure("The map couldn't load."));
    return () => {
      cancelled = true;
      created?.remove();
      setMap(null);
      setReady(false);
    };
  }, [token]);

  useEffect(() => {
    if (map && ready) map.setConfigProperty("basemap", "lightPreset", lightPreset(theme));
  }, [map, ready, theme]);

  /** The map, but only once its style is ready for Voyager's layers and markers. */
  return { container, map: ready ? map : null, failure, theme };
}
