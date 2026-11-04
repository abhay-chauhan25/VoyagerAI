"use client";

import { useEffect, useRef } from "react";
import type { Feature, LineString } from "geojson";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import { prefersReducedMotion, useMapbox, useTheme } from "@/components/map/use-mapbox";
import { dayHue, resolveHue } from "@/lib/hues";

export type MapStop = { id: string; name: string; latitude: number; longitude: number };
export type MapDay = {
  index: number;
  stops: MapStop[];
  /** The street path, or null when times are straight-line estimates (drawn dashed). */
  line: [number, number][] | null;
};

type Props = {
  token: string | undefined;
  days: MapDay[];
  selectedDay: number | null;
  hotStop: string | null;
  focusStop: { id: string; at: number } | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
};

const DRAW_MS = 900;

function lineFor(day: MapDay): Feature<LineString> {
  const coordinates =
    day.line && day.line.length > 1
      ? day.line
      : day.stops.map((s) => [s.longitude, s.latitude] as [number, number]);
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

const routeId = (i: number) => `trip-route-${i}`;

function ensureRoute(map: MapboxMap, day: MapDay, colour: string) {
  const id = routeId(day.index);
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) {
    source.setData(lineFor(day));
  } else {
    map.addSource(id, { type: "geojson", data: lineFor(day), lineMetrics: true });
    map.addLayer({
      id,
      type: "line",
      slot: "middle",
      source: id,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colour,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 6],
        "line-emissive-strength": 1,
      },
    });
  }
  map.setPaintProperty(id, "line-color", colour);
  map.setPaintProperty(id, "line-dasharray", day.line ? [1, 0] : [1.2, 1.4]);
}

/** Draws a route from its first stop to its last, once, when it is new or has changed. */
function drawIn(map: MapboxMap, id: string) {
  if (prefersReducedMotion()) return;
  const start = performance.now();
  const step = (now: number) => {
    if (!map.getLayer(id)) return;
    const t = Math.min(1, (now - start) / DRAW_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    map.setPaintProperty(id, "line-trim-offset", [eased, 1]);
    if (t < 1) requestAnimationFrame(step);
    else map.setPaintProperty(id, "line-trim-offset", [0, 0]);
  };
  map.setPaintProperty(id, "line-trim-offset", [0, 1]);
  requestAnimationFrame(step);
}

/**
 * The trip on a map: each day's route and numbered pins in that day's colour. Pointing at a pin
 * highlights its stop in the timeline and the other way round. The timeline is the accessible
 * equivalent; the pins are mouse and touch shortcuts to it.
 */
export function TripMap({ token, days, selectedDay, hotStop, focusStop, onHover, onPick }: Props) {
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const drawn = useRef(new Map<number, string>());
  const callbacks = useRef({ onHover, onPick });
  const theme = useTheme();
  const dataRef = useRef(days);
  useEffect(() => {
    callbacks.current = { onHover, onPick };
    dataRef.current = days;
  });

  const { container, map, failure } = useMapbox(
    token,
    { center: [0, 20], zoom: 1.5, pitch: 40, cooperativeGestures: true },
    (m) => {
      drawn.current.clear();
      dataRef.current.forEach((day) => ensureRoute(m, day, resolveHue(dayHue(day.index))));
    },
    (m, mapboxgl) => {
      m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    },
  );

  // Routes and pins follow the trip; changed routes draw themselves in.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const apply = async () => {
      const { default: mapboxgl } = await import("mapbox-gl");
      if (cancelled) return;
      const live = new Set<string>();
      days.forEach((day) => {
        const colour = resolveHue(dayHue(day.index));
        ensureRoute(map, day, colour);
        const signature = JSON.stringify(lineFor(day).geometry.coordinates);
        if (drawn.current.get(day.index) !== signature && day.stops.length > 1)
          drawIn(map, routeId(day.index));
        drawn.current.set(day.index, signature);
        day.stops.forEach((stop, i) => {
          live.add(stop.id);
          let entry = markers.current.get(stop.id);
          if (!entry) {
            const el = document.createElement("button");
            el.type = "button";
            el.className = "trip-pin";
            el.addEventListener("mouseenter", () => callbacks.current.onHover(stop.id));
            el.addEventListener("mouseleave", () => callbacks.current.onHover(null));
            el.addEventListener("click", () => callbacks.current.onPick(stop.id));
            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat([stop.longitude, stop.latitude])
              .addTo(map);
            entry = { marker, el };
            markers.current.set(stop.id, entry);
          }
          entry.marker.setLngLat([stop.longitude, stop.latitude]);
          entry.el.textContent = String(i + 1);
          entry.el.style.setProperty("--hue", `var(--hue-${dayHue(day.index)})`);
          entry.el.setAttribute("aria-label", `Day ${day.index + 1}, stop ${i + 1}: ${stop.name}`);
          entry.el.dataset.day = String(day.index);
        });
      });
      for (const [id, entry] of markers.current) {
        if (!live.has(id)) {
          entry.marker.remove();
          markers.current.delete(id);
        }
      }
      // Days that no longer exist lose their routes.
      for (let i = days.length; map.getLayer(routeId(i)); i++) {
        map.removeLayer(routeId(i));
        map.removeSource(routeId(i));
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [map, days, theme]);

  // Selecting a day fades the others and frames it; "all days" frames the whole trip.
  useEffect(() => {
    if (!map) return;
    const frame = async () => {
      const { default: mapboxgl } = await import("mapbox-gl");
      const shown = days.filter((d) => selectedDay === null || d.index === selectedDay);
      const points = shown.flatMap((d) => d.stops);
      for (const day of days) {
        const dim = selectedDay !== null && day.index !== selectedDay;
        if (map.getLayer(routeId(day.index)))
          map.setPaintProperty(routeId(day.index), "line-opacity", dim ? 0.2 : 1);
      }
      for (const entry of markers.current.values()) {
        entry.el.classList.toggle(
          "is-dim",
          selectedDay !== null && entry.el.dataset.day !== String(selectedDay),
        );
      }
      if (points.length === 0) return;
      const bounds = new mapboxgl.LngLatBounds();
      for (const p of points) bounds.extend([p.longitude, p.latitude]);
      map.fitBounds(bounds, {
        padding: 72,
        maxZoom: 15.5,
        duration: prefersReducedMotion() ? 0 : 900,
      });
    };
    void frame();
  }, [map, days, selectedDay]);

  // Pointing at a stop anywhere lifts its pin.
  useEffect(() => {
    for (const [id, entry] of markers.current) entry.el.classList.toggle("is-hot", id === hotStop);
  }, [hotStop, days]);

  // Choosing a stop in the timeline glides the map to it.
  useEffect(() => {
    if (!map || !focusStop) return;
    const stop = days.flatMap((d) => d.stops).find((s) => s.id === focusStop.id);
    if (!stop) return;
    const target = {
      center: [stop.longitude, stop.latitude] as [number, number],
      zoom: Math.max(map.getZoom(), 15),
    };
    if (prefersReducedMotion()) map.jumpTo(target);
    else map.easeTo({ ...target, duration: 700 });
  }, [map, focusStop, days]);

  if (!token || failure) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-card border border-dashed border-control px-6 text-center text-ui text-muted">
        {failure ?? "Maps are off: add NEXT_PUBLIC_MAPBOX_TOKEN to .env to see this trip on a map."}
      </div>
    );
  }
  return (
    <div
      ref={container}
      role="region"
      aria-label="Map of the trip. Each day's route and stops are listed in the timeline."
      className="h-full min-h-64 w-full overflow-hidden rounded-card bg-night"
    />
  );
}
