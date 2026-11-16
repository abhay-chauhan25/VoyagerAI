/** Whether the plane is shown as a live 3D scene or as the drawn cutaway. */
export type Stage = "live" | "drawn";
export type StagePreference = "auto" | Stage;
export const STAGE_STORAGE_KEY = "voyager-plane";

export function isStagePreference(value: unknown): value is StagePreference {
  return value === "auto" || value === "live" || value === "drawn";
}

/** What the browser can tell us about the device before any 3D is loaded. */
export type DeviceSignals = {
  webgl: boolean;
  /** The graphics renderer's name, when the browser reveals it. */
  renderer: string | null;
  reducedMotion: boolean;
  saveData: boolean;
  /** Gigabytes of memory and processor cores, when the browser reports them. */
  memory: number | null;
  cores: number | null;
};

const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const MIN_MEMORY_GB = 4;
const MIN_CORES = 4;

/**
 * Chooses the stage. A traveller's own choice wins, as long as the device can draw 3D at all.
 * Otherwise the live plane is shown only where it is likely to be smooth: real graphics hardware,
 * enough memory, no data-saver, and no request for reduced motion.
 */
export function chooseStage(signals: DeviceSignals, preference: StagePreference = "auto"): Stage {
  if (!signals.webgl) return "drawn";
  if (preference !== "auto") return preference;
  if (signals.reducedMotion || signals.saveData) return "drawn";
  if (signals.renderer && SOFTWARE_RENDERERS.test(signals.renderer)) return "drawn";
  if (signals.memory !== null && signals.memory < MIN_MEMORY_GB) return "drawn";
  if (signals.cores !== null && signals.cores < MIN_CORES) return "drawn";
  return "live";
}

export type Quality = "high" | "low";

/** Phones and tablets start on the lighter settings; so does anything with a low-density screen. */
export function startingQuality(coarsePointer: boolean, narrow: boolean): Quality {
  return coarsePointer || narrow ? "low" : "high";
}

const SMOOTH_FPS = 40;
const UNUSABLE_FPS = 18;

/**
 * Judges a few seconds of measured frame rate. A scene that is struggling steps down to the lighter
 * settings; one that still cannot keep up hands over to the drawn cutaway.
 */
export function judgeFrameRate(fps: number, quality: Quality): "keep" | "lower" | "give-up" {
  if (!Number.isFinite(fps) || fps <= 0) return "keep";
  if (fps >= SMOOTH_FPS) return "keep";
  if (quality === "high") return "lower";
  return fps < UNUSABLE_FPS ? "give-up" : "keep";
}
