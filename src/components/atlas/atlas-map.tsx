"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { FilterSpecification, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { prefersReducedMotion, useMapbox } from "@/components/map/use-mapbox";
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

const COUNTRIES_URL = "/geo/countries-110m.json";
/** The idle globe turns this many degrees per second, and only when zoomed out. */
const SPIN_DEGREES_PER_SECOND = 3;
const SPIN_MAX_ZOOM = 3;
/** After the traveller lets go, the globe waits this long before turning again. */
const SPIN_RESUME_MS = 4000;

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

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Adds Voyager's layers to a freshly loaded style, in Mapbox Standard's slots. */
function addLayers(map: MapboxMap, countryCodes: readonly string[], cities: readonly MapCity[]) {
  const accent = cssVar("--accent", "#2456d6");
  const filter: FilterSpecification = ["in", ["get", "iso"], ["literal", [...countryCodes]]];

  map.addSource("countries", { type: "geojson", data: COUNTRIES_URL });
  map.addLayer({
    id: "visited-countries",
    type: "fill",
    slot: "middle",
    source: "countries",
    filter,
    paint: { "fill-color": accent, "fill-opacity": 0.45, "fill-emissive-strength": 1 },
  });
  map.addLayer({
    id: "visited-country-edges",
    type: "line",
    slot: "middle",
    source: "countries",
    filter,
    paint: { "line-color": accent, "line-width": 1.25, "line-emissive-strength": 1 },
  });
  map.addSource("cities", { type: "geojson", data: cityFeatures(cities) });
  map.addLayer({
    id: "visited-cities",
    type: "circle",
    slot: "top",
    source: "cities",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.5, 6, 7],
      "circle-color": "#ffffff",
      "circle-stroke-color": accent,
      "circle-stroke-width": 2,
      "circle-emissive-strength": 1,
    },
  });
}

/**
 * The Atlas globe: visited countries filled in the accent, visited cities as dots, on Mapbox
 * Standard lit for Day or Night. At rest it turns slowly until touched (never with reduced motion).
 * The visible list beside the map is the accessible equivalent of this picture.
 */
export function AtlasMap({ token, countryCodes, cities, label }: Props) {
  const data = useRef({ countryCodes, cities });
  const previousIds = useRef(new Set(cities.map((c) => c.id)));

  const { container, map, failure } = useMapbox(
    token,
    { projection: "globe", center: [10, 30], zoom: 1.1, cooperativeGestures: true },
    (m) => addLayers(m, data.current.countryCodes, data.current.cities),
    (m, mapboxgl) => {
      m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      // Frame the traveller's own places once, so a new map opens on them rather than the Atlantic.
      m.once("load", () => {
        const points: LngLat[] = data.current.cities.map((c) => [c.longitude, c.latitude]);
        const centre = sphericalCentroid(points);
        if (!centre) return;
        if (angularSpread(points, centre) > WIDE_SPREAD_DEGREES) {
          m.jumpTo({ center: centre, zoom: 1.1 });
        } else {
          const bounds = new mapboxgl.LngLatBounds();
          for (const point of points) bounds.extend(point);
          m.fitBounds(bounds, { padding: 64, maxZoom: 4, duration: 0 });
        }
      });
    },
  );

  // The idle spin: one second of turning at a time, chained, paused by any touch or drag.
  useEffect(() => {
    if (!map || prefersReducedMotion()) return;
    let held = false;
    let resumeTimer: number | undefined;
    const spin = () => {
      if (held || map.getZoom() > SPIN_MAX_ZOOM) return;
      const centre = map.getCenter();
      centre.lng -= SPIN_DEGREES_PER_SECOND;
      map.easeTo({ center: centre, duration: 1000, easing: (t) => t });
    };
    const hold = () => {
      held = true;
      window.clearTimeout(resumeTimer);
    };
    const release = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        held = false;
        spin();
      }, SPIN_RESUME_MS);
    };
    map.on("mousedown", hold);
    map.on("touchstart", hold);
    map.on("wheel", hold);
    map.on("mouseup", release);
    map.on("touchend", release);
    map.on("moveend", spin);
    spin();
    return () => {
      window.clearTimeout(resumeTimer);
      map.off("mousedown", hold);
      map.off("touchstart", hold);
      map.off("wheel", hold);
      map.off("mouseup", release);
      map.off("touchend", release);
      map.off("moveend", spin);
    };
  }, [map]);

  // Data changes (a place added or removed): remember them for the next style load, and update the
  // live map's filters and points in place.
  useEffect(() => {
    data.current = { countryCodes, cities };
    const previous = previousIds.current;
    previousIds.current = new Set(cities.map((c) => c.id));
    if (!map || !map.getLayer("visited-countries")) return;
    // Show a newly added city: fly there, or jump when the user prefers less motion.
    const added = cities.find((c) => !previous.has(c.id));
    if (added) {
      const target = {
        center: [added.longitude, added.latitude] as LngLat,
        zoom: Math.max(map.getZoom(), 2.5),
      };
      if (prefersReducedMotion()) map.jumpTo(target);
      else map.flyTo({ ...target, duration: 1400, essential: false });
    }
    const filter: FilterSpecification = ["in", ["get", "iso"], ["literal", [...countryCodes]]];
    map.setFilter("visited-countries", filter);
    map.setFilter("visited-country-edges", filter);
    (map.getSource("cities") as GeoJSONSource | undefined)?.setData(cityFeatures(cities));
  }, [map, countryCodes, cities]);

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
      className="h-full min-h-64 w-full overflow-hidden rounded-card bg-night"
    />
  );
}
