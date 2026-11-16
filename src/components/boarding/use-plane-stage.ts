"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STAGE_STORAGE_KEY,
  chooseStage,
  isStagePreference,
  startingQuality,
  type DeviceSignals,
  type Quality,
  type Stage,
  type StagePreference,
} from "@/lib/boarding/stage";

type Connection = { saveData?: boolean };
type DeviceNavigator = Navigator & { deviceMemory?: number; connection?: Connection };

/** Asks the browser what it can draw, without loading any 3D code. */
function readSignals(): DeviceSignals {
  let webgl = false;
  let renderer: string | null = null;
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    if (context) {
      webgl = true;
      const info = context.getExtension("WEBGL_debug_renderer_info");
      renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
      context.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl = false; // a blocked or crashed graphics context means the drawn plane
  }
  const device = navigator as DeviceNavigator;
  return {
    webgl,
    renderer,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: device.connection?.saveData === true,
    memory: typeof device.deviceMemory === "number" ? device.deviceMemory : null,
    cores: typeof device.hardwareConcurrency === "number" ? device.hardwareConcurrency : null,
  };
}

function readPreference(): StagePreference {
  try {
    const stored = localStorage.getItem(STAGE_STORAGE_KEY);
    return isStagePreference(stored) ? stored : "auto";
  } catch {
    return "auto"; // storage blocked: decide from the device alone
  }
}

export type PlaneStage = {
  /** Null until the device has been checked; the drawn plane shows meanwhile. */
  stage: Stage | null;
  /** Whether this device can draw the live plane at all. */
  capable: boolean;
  quality: Quality;
  choose: (stage: Stage) => void;
};

/**
 * Decides, once the page is in the browser, whether to show the live plane or the drawn one, and
 * remembers a traveller's own choice between them.
 */
export function usePlaneStage(): PlaneStage {
  const [state, setState] = useState<{ stage: Stage; capable: boolean; quality: Quality } | null>(
    null,
  );

  useEffect(() => {
    const signals = readSignals();
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    // Read once on arrival: the device does not change while the page is open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      stage: chooseStage(signals, readPreference()),
      capable: signals.webgl,
      quality: startingQuality(coarse, narrow),
    });
  }, []);

  const choose = useCallback((stage: Stage) => {
    try {
      localStorage.setItem(STAGE_STORAGE_KEY, stage);
    } catch {
      // The choice still applies for this visit.
    }
    setState((current) => (current ? { ...current, stage } : current));
  }, []);

  return {
    stage: state?.stage ?? null,
    capable: state?.capable ?? false,
    quality: state?.quality ?? "low",
    choose,
  };
}
