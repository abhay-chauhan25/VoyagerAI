import {
  clusterIntoDays,
  composePlan,
  orderCost,
  orderDay,
  pickCandidates,
  ruleDayTitle,
  type Candidate,
} from "@/lib/trips/compose";
import { visitState } from "@/lib/trips/hours";
import {
  chooseMode,
  estimateLeg,
  formatDuration,
  formatMinute,
  localTime,
  scheduleDay,
  type HoursCheck,
} from "@/lib/trips/schedule";

/** Real public landmarks: two in Lisbon's centre, two in Belém (about 6 km west). */
function place(
  key: string,
  name: string,
  latitude: number,
  longitude: number,
  extra: Partial<Candidate> = {},
): Candidate {
  return {
    key,
    name,
    latitude,
    longitude,
    score: 0.5,
    dwell: 60,
    evening: false,
    hours: null,
    ...extra,
  };
}
const castle = place("osm:node/1", "Castelo de São Jorge", 38.7139, -9.1335, { score: 0.9 });
const cathedral = place("osm:node/2", "Lisbon Cathedral", 38.7099, -9.1335, { score: 0.6 });
const tower = place("osm:node/3", "Belém Tower", 38.6916, -9.216, { score: 0.8 });
const monastery = place("osm:node/4", "Jerónimos Monastery", 38.6979, -9.2068, { score: 0.7 });

const alwaysOpen: HoursCheck = () => "open";
const ctx = { startDate: "2026-11-13", dayIndex: 0, mode: "walking" as const, check: alwaysOpen };

describe("schedule", () => {
  it("estimates walking and driving legs, longer by car overhead for short hops", () => {
    const walk = estimateLeg(castle, cathedral, "walking");
    expect(walk.meters).toBeGreaterThan(500);
    expect(walk.meters).toBeLessThan(700);
    const drive = estimateLeg(castle, cathedral, "driving");
    expect(drive.seconds).toBeGreaterThan(4 * 60);
  });

  it("walks short days and drives when a hop is long", () => {
    expect(chooseMode([castle, cathedral])).toBe("walking");
    expect(chooseMode([castle, tower])).toBe("driving");
    expect(chooseMode([])).toBe("walking");
  });

  it("times a day from 09:30 and checks each visit's hours", () => {
    const timed = scheduleDay(
      [
        { dwell: 60, hours: null },
        { dwell: 30, hours: null },
      ],
      [{ seconds: 600, meters: 800 }],
      "2026-11-13",
      0,
      (spec, arrive) => (arrive.getHours() >= 10 ? "open" : "closed"),
    );
    expect(timed.map((t) => [t.arrive, t.leave, t.state])).toEqual([
      [570, 630, "closed"],
      [640, 670, "open"],
    ]);
  });

  it("builds local times and formats them", () => {
    const at = localTime("2026-11-13", 2, 615);
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([15, 10, 15]);
    expect(formatMinute(570)).toBe("09:30");
    expect(formatMinute(1500)).toBe("01:00");
    expect(formatDuration(30)).toBe("1 min");
    expect(formatDuration(3900)).toBe("1 h 5 min");
  });
});

describe("compose", () => {
  it("picks the best places up to the trip's capacity", () => {
    expect(pickCandidates([cathedral, tower, castle, monastery], 1, 2).map((c) => c.key)).toEqual([
      castle.key,
      tower.key,
    ]);
  });

  it("groups nearby places into the same day, best day first", () => {
    const days = clusterIntoDays(pickCandidates([castle, cathedral, tower, monastery], 2, 2), 2);
    expect(days.map((d) => d.map((c) => c.key).sort())).toEqual([
      [castle.key, cathedral.key],
      [tower.key, monastery.key],
    ]);
  });

  it("never overloads a day, and leaves extra days empty when there are few places", () => {
    const days = clusterIntoDays([castle, cathedral, tower], 2);
    expect(Math.max(...days.map((d) => d.length))).toBe(2);
    expect(clusterIntoDays([castle], 3).map((d) => d.length)).toEqual([1, 0, 0]);
    expect(clusterIntoDays([castle], 0)).toEqual([]);
  });

  it("orders a day around opening hours", () => {
    // The museum opens at 11:00, so visiting it first would mean arriving to a closed door.
    const museum = place("osm:node/5", "Museum", 38.711, -9.1335, { hours: "10:00-11:00" });
    const lateOpener = place("osm:node/6", "Late museum", 38.7105, -9.1336, {
      hours: "11:00-18:00",
    });
    const check: HoursCheck = (spec, arrive) => {
      if (!spec) return "open";
      const [from, to] = spec.split("-").map((t) => Number(t.slice(0, 2)) * 60);
      const minute = arrive.getHours() * 60 + arrive.getMinutes();
      return minute >= from! && minute < to! ? "open" : "closed";
    };
    const order = orderDay([lateOpener, castle, museum], { ...ctx, check });
    expect(order.at(-1)?.key).toBe(lateOpener.key);
    expect(orderCost(order, { ...ctx, check })).toBeLessThan(
      orderCost([lateOpener, castle, museum], { ...ctx, check }),
    );
  });

  it("puts evening places last", () => {
    const bar = place("osm:node/7", "Bar", 38.7139, -9.1336, { evening: true });
    expect(orderDay([bar, castle, cathedral], ctx).at(-1)?.key).toBe(bar.key);
  });

  it("orders long days without trying every permutation", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      place(`osm:node/${100 + i}`, `Stop ${i}`, 38.7 + (i % 3) * 0.004, -9.14 + i * 0.003),
    );
    const order = orderDay(many, ctx);
    expect(new Set(order.map((p) => p.key)).size).toBe(9);
  });

  it("composes a whole plan with modes per day", () => {
    const plan = composePlan([castle, cathedral, tower, monastery], {
      days: 2,
      perDay: 2,
      startDate: "2026-11-13",
      check: alwaysOpen,
    });
    expect(plan).toHaveLength(2);
    expect(plan.every((d) => d.mode === "walking")).toBe(true);
    expect(plan.flatMap((d) => d.stops)).toHaveLength(4);
  });

  it("names a day after its best place, and leaves empty days unnamed", () => {
    expect(ruleDayTitle([cathedral, castle])).toBe("Castelo de São Jorge and around");
    expect(ruleDayTitle([castle])).toBe("Castelo de São Jorge");
    expect(ruleDayTitle([])).toBeNull();
  });
});

describe("visitState (OpenStreetMap opening_hours)", () => {
  const friday10 = new Date(2026, 10, 13, 10, 0);
  const friday11 = new Date(2026, 10, 13, 11, 0);
  const monday10 = new Date(2026, 10, 9, 10, 0);

  it("knows when a place is open for the whole visit", () => {
    expect(visitState("Tu-Su 09:00-18:00", friday10, friday11)).toBe("open");
  });

  it("reports closed days and visits that run past closing", () => {
    expect(visitState("Tu-Su 09:00-18:00", monday10, new Date(2026, 10, 9, 11))).toBe("closed");
    expect(visitState("Mo-Fr 09:00-10:30", friday10, friday11)).toBe("closes-during");
  });

  it("treats missing and malformed hours as unknown, never as closed", () => {
    expect(visitState(null, friday10, friday11)).toBe("unknown");
    expect(visitState("whenever the owner feels like it", friday10, friday11)).toBe("unknown");
    expect(visitState('Mo-Su 10:00-18:00 "by appointment"', friday10, friday11)).toBe("unknown");
  });
});
