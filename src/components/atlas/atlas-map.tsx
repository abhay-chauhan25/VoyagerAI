"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { FilterSpecification, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import {
  angularSpread,
  sphericalCentroid,
  WIDE_SPREAD_DEGREES,
  type LngLat,
} from "@/lib/atlas/camera";

export type MapCity = { id: number; name: string; latitude: number; longitude: number };

type Props = {
  token: string | undefined;
  countryCodes: readonly string[];
  cities: readonly MapCity[];
  label: string;
};

const STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;
const COUNTRIES_URL = "/geo/countries-110m.json";

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
function currentTheme(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function cityFeatures(cities: readonly MapCity[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: cities.map((c) => ({
      type: "Feature",
      properties: { name: c.name },
      geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
    })),
  };
}

/** A quiet atmosphere in the page's own colours instead of the default star field. */
function applyAtmosphere(map: MapboxMap) {
  const css = getComputedStyle(document.documentElement);
  const ground = css.getPropertyValue("--ground").trim() || "#e6e5e1";
  const surface = css.getPropertyValue("--surface").trim() || "#d3d2ce";
  map.setFog({
    color: surface,
    "high-color": surface,
    "space-color": ground,
    "horizon-blend": 0.04,
    "star-intensity": 0,
  });
}

/** Adds Voyager's layers to a freshly loaded style (they are dropped whenever the style changes). */
function addLayers(map: MapboxMap, countryCodes: readonly string[], cities: readonly MapCity[]) {
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim() || "#2456d6";
  const ink = css.getPropertyValue("--ink").trim() || "#26251e";

  map.addSource("countries", { type: "geojson", data: COUNTRIES_URL });
  map.addLayer({
    id: "visited-countries",
    type: "fill",
    source: "countries",
    filter: ["in", ["get", "iso"], ["literal", [...countryCodes]]],
    paint: { "fill-color": accent, "fill-opacity": 0.55 },
  });
  map.addLayer({
    id: "visited-country-edges",
    type: "line",
    source: "countries",
    filter: ["in", ["get", "iso"], ["literal", [...countryCodes]]],
    paint: { "line-color": accent, "line-width": 1 },
  });
  map.addSource("cities", { type: "geojson", data: cityFeatures(cities) });
  map.addLayer({
    id: "visited-cities",
    type: "circle",
    source: "cities",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3, 6, 6],
      "circle-color": ink,
      "circle-stroke-color": accent,
      "circle-stroke-width": 1.5,
    },
  });
}

/**
 * The Atlas globe: visited countries filled in the accent, visited cities as dots. Mapbox is loaded
 * only in the browser. The visible list beside the map is the accessible equivalent of this picture.
 */
export function AtlasMap({ token, countryCodes, cities, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const data = useRef({ countryCodes, cities });
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as const);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !container.current) return;
    let cancelled = false;
    let map: MapboxMap | undefined;

    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled || !container.current) return;
        mapboxgl.accessToken = token;
        map = new mapboxgl.Map({
          container: container.current,
          style: STYLES[currentTheme()],
          projection: "globe",
          center: [10, 30],
          zoom: 1.1,
          cooperativeGestures: true,
          attributionControl: true,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.on("style.load", () => {
          if (!map) return;
          applyAtmosphere(map);
          addLayers(map, data.current.countryCodes, data.current.cities);
        });
        // Frame the traveller's own places once, so a new map opens on them rather than the Atlantic.
        map.once("load", () => {
          const points: LngLat[] = data.current.cities.map((c) => [c.longitude, c.latitude]);
          const centre = sphericalCentroid(points);
          if (!map || !centre) return;
          if (angularSpread(points, centre) > WIDE_SPREAD_DEGREES) {
            map.jumpTo({ center: centre, zoom: 1.1 });
          } else {
            const bounds = new mapboxgl.LngLatBounds();
            for (const point of points) bounds.extend(point);
            map.fitBounds(bounds, { padding: 64, maxZoom: 4, duration: 0 });
          }
        });
        map.on("error", (event) => {
          // Mapbox reports a bad or restricted token as an error event, not an exception.
          const status = (event.error as { status?: number } | undefined)?.status;
          if (status === 401 || status === 403)
            setFailure("The map couldn't load: check the Mapbox token and its URL restrictions.");
        });
        mapRef.current = map;
      })
      .catch(() => setFailure("The map couldn't load. Your places are listed below."));

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Theme switch: swap the base style; the style.load handler re-adds Voyager's layers.
  useEffect(() => {
    mapRef.current?.setStyle(STYLES[theme]);
  }, [theme]);

  // Data changes (a place added or removed): remember them for the next style load, and update the
  // live map's filters and points in place.
  useEffect(() => {
    const previous = new Set(data.current.cities.map((c) => c.id));
    data.current = { countryCodes, cities };
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer("visited-countries")) return;
    // Show a newly added city: fly there, or jump when the user prefers less motion.
    const added = cities.find((c) => !previous.has(c.id));
    if (added) {
      const target = {
        center: [added.longitude, added.latitude] as LngLat,
        zoom: Math.max(map.getZoom(), 2.5),
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.jumpTo(target);
      else map.flyTo({ ...target, duration: 1400, essential: false });
    }
    const filter: FilterSpecification = ["in", ["get", "iso"], ["literal", [...countryCodes]]];
    map.setFilter("visited-countries", filter);
    map.setFilter("visited-country-edges", filter);
    (map.getSource("cities") as GeoJSONSource | undefined)?.setData(cityFeatures(cities));
  }, [countryCodes, cities]);

  if (!token || failure) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-card border border-dashed border-control px-6 text-center text-ui text-muted">
        {failure ??
          "Maps are off: add NEXT_PUBLIC_MAPBOX_TOKEN to .env to see your globe. Your places are listed below."}
      </div>
    );
  }

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      className="h-full min-h-64 w-full overflow-hidden rounded-card bg-raised"
    />
  );
}
