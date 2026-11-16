import {
  MAX_ELEVATION,
  angleDelta,
  clamp,
  damping,
  easeInOut,
  fitDistance,
  mixPose,
  posePosition,
} from "@/lib/boarding/flight";
import { HULL, hullCentre, hullPoint, hullRadius } from "@/lib/boarding/hull";
import {
  HOME_POSE,
  PLANE_SECTIONS,
  PLANE_SECTION_IDS,
  findSection,
  sectionForPath,
} from "@/lib/boarding/sections";
import {
  chooseStage,
  isStagePreference,
  judgeFrameRate,
  startingQuality,
  type DeviceSignals,
} from "@/lib/boarding/stage";
import { isProtectedPath } from "@/lib/auth/routes";

const capable: DeviceSignals = {
  webgl: true,
  renderer: "ANGLE (Apple, Apple M2, OpenGL 4.1)",
  reducedMotion: false,
  saveData: false,
  memory: 8,
  cores: 8,
};

describe("plane sections", () => {
  it("gives every part one section, with a unique link and code", () => {
    expect(PLANE_SECTIONS.map((section) => section.id)).toEqual([...PLANE_SECTION_IDS]);
    expect(new Set(PLANE_SECTIONS.map((section) => section.href)).size).toBe(6);
    expect(new Set(PLANE_SECTIONS.map((section) => section.code)).size).toBe(6);
  });

  it("keeps every existing section of the app reachable from the plane", () => {
    const links = PLANE_SECTIONS.map((section) => section.href);
    for (const href of ["/trips", "/huddle", "/dna", "/drift", "/atlas", "/notes"]) {
      expect(links).toContain(href);
    }
  });

  it("only links to pages that need a signed-in traveller", () => {
    for (const section of PLANE_SECTIONS) expect(isProtectedPath(section.href)).toBe(true);
    expect(isProtectedPath("/board")).toBe(true);
  });

  it("keeps markers on the drawing and camera poses within reach", () => {
    for (const section of PLANE_SECTIONS) {
      expect(section.flat.x).toBeGreaterThan(0);
      expect(section.flat.x).toBeLessThan(100);
      expect(section.flat.y).toBeGreaterThan(0);
      expect(section.flat.y).toBeLessThan(100);
      for (const pose of [section.view, section.enter]) {
        expect(pose.zoom).toBeGreaterThan(0);
        expect(pose.elevation).toBeLessThanOrEqual(MAX_ELEVATION);
      }
      // Stepping inside always moves the camera closer.
      expect(section.enter.zoom).toBeLessThan(section.view.zoom);
    }
  });

  it("finds a section by id and by the page it opens", () => {
    expect(findSection("cabin")?.feature).toBe("Huddle");
    expect(sectionForPath("/trips/abc/drift")?.id).toBe("cockpit");
    expect(sectionForPath("/dna")?.id).toBe("galley");
  });

  it("returns nothing for unknown ids and pages outside the plane", () => {
    expect(findSection("lavatory")).toBeNull();
    expect(findSection(null)).toBeNull();
    expect(sectionForPath("/account")).toBeNull();
    expect(sectionForPath("/tripsy")).toBeNull();
  });
});

describe("hull", () => {
  it("is full width along the cabin and closes at both ends", () => {
    expect(hullRadius(0)).toBe(HULL.radius);
    expect(hullRadius(HULL.nose)).toBeCloseTo(0, 5);
    expect(hullRadius(HULL.tail)).toBeLessThan(HULL.radius * 0.2);
  });

  it("has no size outside the aircraft", () => {
    expect(hullRadius(HULL.nose + 1)).toBe(0);
    expect(hullRadius(HULL.tail - 1)).toBe(0);
  });

  it("droops at the nose and sweeps up at the tail", () => {
    expect(hullCentre(0)).toBe(0);
    expect(hullCentre(HULL.nose - 0.5)).toBeLessThan(0);
    expect(hullCentre(HULL.tail + 0.5)).toBeGreaterThan(0);
  });

  it("places points on the skin: roof above, belly below, sides at the waterline", () => {
    const roof = hullPoint(0, -Math.PI / 2);
    const belly = hullPoint(0, Math.PI / 2);
    const side = hullPoint(0, 0, 0.5);
    expect(roof[1]).toBeCloseTo(HULL.radius);
    expect(belly[1]).toBeCloseTo(-HULL.radius);
    expect(side[2]).toBeCloseTo(HULL.radius + 0.5);
    expect(side[1]).toBeCloseTo(0);
  });
});

describe("camera", () => {
  it("backs away on a tall phone screen and comes closer on a wide one", () => {
    expect(fitDistance(0.46)).toBeGreaterThan(fitDistance(1.78));
  });

  it("falls back to a square view for a frame with no size", () => {
    expect(fitDistance(0)).toBe(fitDistance(1));
    expect(fitDistance(Number.NaN)).toBe(fitDistance(1));
  });

  it("places the camera at the pose's distance from its target", () => {
    const at = posePosition(HOME_POSE, 50);
    const distance = Math.hypot(
      at[0] - HOME_POSE.target[0],
      at[1] - HOME_POSE.target[1],
      at[2] - HOME_POSE.target[2],
    );
    expect(distance).toBeCloseTo(50);
    expect(at[1]).toBeGreaterThan(HOME_POSE.target[1]);
  });

  it("turns the short way round", () => {
    expect(angleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it("mixes poses from one end to the other", () => {
    const to = PLANE_SECTIONS[0]!.view;
    expect(mixPose(HOME_POSE, to, 0)).toEqual(HOME_POSE);
    const end = mixPose(HOME_POSE, to, 1);
    expect(end.zoom).toBeCloseTo(to.zoom);
    expect(end.target[0]).toBeCloseTo(to.target[0]);
  });

  it("eases and clamps within bounds, whatever it is given", () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(2)).toBe(1);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
  });

  it("covers more of the distance in a longer frame, and none in no time", () => {
    expect(damping(4, 0)).toBe(0);
    expect(damping(4, -1)).toBe(0);
    expect(damping(4, 0.1)).toBeGreaterThan(damping(4, 0.016));
    expect(damping(4, 10)).toBeLessThanOrEqual(1);
  });
});

describe("choosing how to show the plane", () => {
  it("shows the live plane on a capable device", () => {
    expect(chooseStage(capable)).toBe("live");
  });

  it("shows the drawing when 3D can't run, whatever the traveller chose", () => {
    expect(chooseStage({ ...capable, webgl: false })).toBe("drawn");
    expect(chooseStage({ ...capable, webgl: false }, "live")).toBe("drawn");
  });

  it("shows the drawing for reduced motion, data saver, software graphics and weak devices", () => {
    expect(chooseStage({ ...capable, reducedMotion: true })).toBe("drawn");
    expect(chooseStage({ ...capable, saveData: true })).toBe("drawn");
    expect(chooseStage({ ...capable, renderer: "Google SwiftShader" })).toBe("drawn");
    expect(chooseStage({ ...capable, memory: 2 })).toBe("drawn");
    expect(chooseStage({ ...capable, cores: 2 })).toBe("drawn");
  });

  it("does not hold unknown device details against it", () => {
    expect(chooseStage({ ...capable, renderer: null, memory: null, cores: null })).toBe("live");
  });

  it("lets a traveller's own choice win on a device that can draw 3D", () => {
    expect(chooseStage({ ...capable, reducedMotion: true }, "live")).toBe("live");
    expect(chooseStage(capable, "drawn")).toBe("drawn");
  });

  it("accepts only known stored choices", () => {
    expect(isStagePreference("live")).toBe(true);
    expect(isStagePreference("auto")).toBe(true);
    expect(isStagePreference("hologram")).toBe(false);
    expect(isStagePreference(null)).toBe(false);
  });

  it("starts phones on the lighter settings", () => {
    expect(startingQuality(true, false)).toBe("low");
    expect(startingQuality(false, true)).toBe("low");
    expect(startingQuality(false, false)).toBe("high");
  });

  it("steps down when frames are slow and gives up only when still unusable", () => {
    expect(judgeFrameRate(58, "high")).toBe("keep");
    expect(judgeFrameRate(25, "high")).toBe("lower");
    expect(judgeFrameRate(25, "low")).toBe("keep");
    expect(judgeFrameRate(10, "low")).toBe("give-up");
  });

  it("ignores a measurement that makes no sense", () => {
    expect(judgeFrameRate(0, "low")).toBe("keep");
    expect(judgeFrameRate(Number.NaN, "high")).toBe("keep");
  });
});
