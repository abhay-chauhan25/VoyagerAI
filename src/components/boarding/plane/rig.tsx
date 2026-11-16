"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import {
  FIELD_OF_VIEW,
  MAX_ELEVATION,
  MIN_ELEVATION,
  angleDelta,
  clamp,
  damping,
  fitDistance,
  posePosition,
} from "@/lib/boarding/flight";
import { HOME_POSE, PLANE_SECTIONS, type PlaneSectionId, type Pose } from "@/lib/boarding/sections";

/** Radians of orbit per pixel dragged. */
const DRAG_SPEED = 0.0055;
/** Radians per second the view turns by itself when nobody is steering. */
const IDLE_TURN = 0.035;
const IDLE_AFTER_SECONDS = 4;
const SETTLE = 3.2;
const ENTER_SETTLE = 4.6;

export type Markers = RefObject<Partial<Record<PlaneSectionId, HTMLElement | null>>>;

type Props = {
  /** A pose to hold, set from outside (the list, the keyboard, or the homepage tour). */
  directed: Pose | null;
  /** The part being stepped into; the camera closes in on it. */
  entering: PlaneSectionId | null;
  /** Whether the traveller may drag to look around. */
  steerable: boolean;
  moving: boolean;
  /** Slides the whole picture across the frame, as fractions of its width and height. */
  shift?: readonly [number, number];
  markers?: Markers;
};

/**
 * The camera. It orbits the plane: dragging turns it, letting go leaves it drifting slowly, and a
 * directed pose (pointing at a part from the list, the homepage tour, stepping inside) eases it
 * there. It also pins the on-page markers to their parts of the plane every frame.
 */
export function Rig({ directed, entering, steerable, moving, shift, markers }: Props) {
  const { camera, gl, size } = useThree();
  const pose = useRef<Pose>({ ...HOME_POSE });
  const free = useRef({ azimuth: HOME_POSE.azimuth, elevation: HOME_POSE.elevation });
  const idleFor = useRef(IDLE_AFTER_SECONDS);
  const dragging = useRef(false);
  const projected = useRef(new THREE.Vector3());
  const settled = useRef(false);
  const slid = useRef<[number, number]>([shift?.[0] ?? 0, shift?.[1] ?? 0]);

  useEffect(() => {
    if (!steerable) return;
    const element = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      last = { x: event.clientX, y: event.clientY };
      dragging.current = true;
      idleFor.current = 0;
    };
    const move = (event: PointerEvent) => {
      if (!last) return;
      free.current.azimuth += (event.clientX - last.x) * DRAG_SPEED;
      free.current.elevation = clamp(
        free.current.elevation + (event.clientY - last.y) * DRAG_SPEED,
        MIN_ELEVATION,
        MAX_ELEVATION,
      );
      last = { x: event.clientX, y: event.clientY };
      idleFor.current = 0;
    };
    const up = () => {
      last = null;
      dragging.current = false;
    };
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, steerable]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);
    idleFor.current += step;
    if (
      moving &&
      !dragging.current &&
      !directed &&
      !entering &&
      idleFor.current > IDLE_AFTER_SECONDS
    ) {
      free.current.azimuth += IDLE_TURN * step;
    }

    const enterPose = entering
      ? (PLANE_SECTIONS.find((section) => section.id === entering)?.enter ?? null)
      : null;
    const goal: Pose =
      enterPose ??
      directed ??
      ({ ...HOME_POSE, azimuth: free.current.azimuth, elevation: free.current.elevation } as Pose);

    // Without motion the camera is simply placed; otherwise it eases towards its goal.
    const ease = !moving || !settled.current ? 1 : damping(enterPose ? ENTER_SETTLE : SETTLE, step);
    settled.current = true;
    const now = pose.current;
    pose.current = {
      azimuth: now.azimuth + angleDelta(now.azimuth, goal.azimuth) * ease,
      elevation: now.elevation + (goal.elevation - now.elevation) * ease,
      zoom: now.zoom + (goal.zoom - now.zoom) * ease,
      target: [
        now.target[0] + (goal.target[0] - now.target[0]) * ease,
        now.target[1] + (goal.target[1] - now.target[1]) * ease,
        now.target[2] + (goal.target[2] - now.target[2]) * ease,
      ],
    };
    // When a directed view is released, carry on orbiting from where it left the camera.
    if (directed || enterPose) {
      free.current.azimuth = pose.current.azimuth;
      free.current.elevation = clamp(pose.current.elevation, MIN_ELEVATION, MAX_ELEVATION);
    }

    // The picture slides to leave room for whatever is written over it.
    slid.current[0] += ((shift?.[0] ?? 0) - slid.current[0]) * ease;
    slid.current[1] += ((shift?.[1] ?? 0) - slid.current[1]) * ease;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.setViewOffset(
        size.width,
        size.height,
        -slid.current[0] * size.width,
        -slid.current[1] * size.height,
        size.width,
        size.height,
      );
    }

    const fit = fitDistance(size.width / Math.max(1, size.height), undefined, FIELD_OF_VIEW);
    const at = posePosition(pose.current, fit);
    camera.position.set(at[0], at[1], at[2]);
    camera.lookAt(pose.current.target[0], pose.current.target[1], pose.current.target[2]);
    camera.updateMatrixWorld();

    const pins = markers?.current;
    if (!pins) return;
    for (const section of PLANE_SECTIONS) {
      const pin = pins[section.id];
      if (!pin) continue;
      // Parts that exist on both sides are marked on the side facing the camera.
      const side = section.mirrored && camera.position.z < 0 ? -1 : 1;
      projected.current
        .set(section.anchor[0], section.anchor[1], section.anchor[2] * side)
        .project(camera);
      const x = (projected.current.x * 0.5 + 0.5) * size.width;
      const y = (-projected.current.y * 0.5 + 0.5) * size.height;
      pin.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      pin.style.visibility = projected.current.z < 1 ? "visible" : "hidden";
    }
  });

  return null;
}
