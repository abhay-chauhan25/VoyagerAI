"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { FIELD_OF_VIEW } from "@/lib/boarding/flight";
import type { PlaneSectionId, Pose } from "@/lib/boarding/sections";
import { judgeFrameRate, type Quality } from "@/lib/boarding/stage";
import type { Hue } from "@/lib/hues";
import { Airliner } from "./plane/airliner";
import { Rig, type Markers } from "./plane/rig";
import { Clouds, LIGHTS, Sky } from "./plane/sky";

const SAMPLE_SECONDS = 2.5;
const CLOUDS: Record<Quality, number> = { high: 260, low: 140 };
const PIXEL_RATIO: Record<Quality, number> = { high: 2, low: 1.25 };

/** Measures the frame rate for a few seconds at a time and reports when the scene can't keep up. */
function FrameRateWatch({
  quality,
  onVerdict,
}: {
  quality: Quality;
  onVerdict: (verdict: "lower" | "give-up") => void;
}) {
  const sample = useRef({ frames: 0, seconds: 0, skipped: false });
  useFrame((_, delta) => {
    const current = sample.current;
    // The first frames include set-up work and say nothing about steady running.
    if (!current.skipped) {
      current.seconds += delta;
      if (current.seconds > 1) sample.current = { frames: 0, seconds: 0, skipped: true };
      return;
    }
    current.frames += 1;
    current.seconds += delta;
    if (current.seconds < SAMPLE_SECONDS) return;
    const verdict = judgeFrameRate(current.frames / current.seconds, quality);
    sample.current = { frames: 0, seconds: 0, skipped: true };
    if (verdict !== "keep") onVerdict(verdict);
  });
  return null;
}

export type PlaneSceneProps = {
  active: PlaneSectionId | null;
  entering: PlaneSectionId | null;
  directed: Pose | null;
  night: boolean;
  hues: Record<Hue, string>;
  moving: boolean;
  steerable: boolean;
  shift?: readonly [number, number];
  /** False while the plane is off screen, so nothing is drawn for nobody. */
  running: boolean;
  startQuality: Quality;
  markers?: Markers;
  onHover?: (id: PlaneSectionId | null) => void;
  onPick?: (id: PlaneSectionId) => void;
  /** Called once the first frame has been drawn. */
  onReady?: () => void;
  /** Called when the device cannot keep the scene smooth even on the lighter settings. */
  onStruggle?: () => void;
};

/** The live plane: sky, clouds, aircraft and camera. Loaded only where 3D will run well. */
export default function PlaneScene({
  active,
  entering,
  directed,
  night,
  hues,
  moving,
  steerable,
  shift,
  running,
  startQuality,
  markers,
  onHover,
  onPick,
  onReady,
  onStruggle,
}: PlaneSceneProps) {
  const [quality, setQuality] = useState<Quality>(startQuality);
  const light = night ? LIGHTS.night : LIGHTS.day;

  return (
    <Canvas
      frameloop={running ? "always" : "never"}
      dpr={[1, PIXEL_RATIO[quality]]}
      camera={{ fov: FIELD_OF_VIEW, near: 0.5, far: 1400, position: [40, 12, 50] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = light.exposure;
        onReady?.();
      }}
      onPointerMissed={() => onHover?.(null)}
      // Vertical swipes still scroll the page; sideways drags turn the plane.
      style={{ touchAction: "pan-y", cursor: steerable ? "grab" : "default" }}
      aria-hidden="true"
    >
      <Sky light={light} night={night} />
      <Clouds light={light} count={CLOUDS[quality]} moving={moving} />
      <Airliner
        active={active}
        hues={hues}
        night={night}
        moving={moving}
        onHover={onHover}
        onPick={onPick}
      />
      <Rig
        directed={directed}
        entering={entering}
        steerable={steerable}
        moving={moving}
        shift={shift}
        markers={markers}
      />
      <FrameRateWatch
        quality={quality}
        onVerdict={(verdict) => (verdict === "lower" ? setQuality("low") : onStruggle?.())}
      />
    </Canvas>
  );
}
