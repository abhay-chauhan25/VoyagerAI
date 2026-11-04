import { applyChanges, type Plan, type PlanStop } from "@/lib/trips/plan";
import {
  planRefs,
  proposalAnswerSchema,
  repairDayTitles,
  repairProposal,
  resolveProposal,
  dayTitlesSchema,
} from "@/lib/trips/prompts";
import { findDay, findStop, ruleProposal } from "@/lib/trips/rules";
import { parseDirections, routeSignature } from "@/lib/trips/routing";
import { changesSchema, composeSchema, layoutSchema } from "@/lib/trips/schemas";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function stop(n: number, day: number, position: number, extra: Partial<PlanStop> = {}): PlanStop {
  return {
    id: ID(n),
    day,
    position,
    sourceKey: `osm:node/${n}`,
    name: `Stop ${n}`,
    category: "Museum",
    outdoor: false,
    score: 0.5,
    latitude: 38.71,
    longitude: -9.14 + n * 0.001,
    ...extra,
  };
}

// A Friday-to-Sunday trip in Lisbon with real public landmarks.
const plan: Plan = {
  days: 3,
  startDate: "2026-11-13",
  stops: [
    stop(1, 0, 0, { name: "Castelo de São Jorge", category: "Castle", outdoor: true, score: 0.9 }),
    stop(2, 0, 1, {
      name: "Miradouro de Santa Luzia",
      category: "Viewpoint",
      outdoor: true,
      score: 0.4,
    }),
    stop(3, 0, 2, { name: "Time Out Market", category: "Market", score: 0.8 }),
    stop(4, 1, 0, { name: "Museu Nacional do Azulejo", score: 0.7 }),
    stop(5, 2, 0, { name: "Belém Tower", category: "Landmark", outdoor: true, score: 0.6 }),
  ],
  spares: [
    {
      sourceKey: "osm:node/9",
      name: "Gulbenkian Museum",
      category: "Museum",
      outdoor: false,
      score: 0.85,
      latitude: 38.737,
      longitude: -9.154,
    },
  ],
};

describe("applyChanges", () => {
  it("moves, removes and adds, and reports the days it touched", () => {
    const result = applyChanges(plan, [
      { type: "move", stopId: ID(2), toDay: 1, reason: "r" },
      { type: "remove", stopId: ID(5), reason: "r" },
      { type: "add", sourceKey: "osm:node/9", toDay: 2, reason: "r" },
    ]);
    expect(result.layout).toEqual([
      { id: ID(1), day: 0, position: 0 },
      { id: ID(3), day: 0, position: 1 },
      { id: ID(4), day: 1, position: 0 },
      { id: ID(2), day: 1, position: 1 },
    ]);
    expect(result.remove).toEqual([ID(5)]);
    expect(result.add).toEqual([{ sourceKey: "osm:node/9", day: 2, position: 0 }]);
    expect(result.touchedDays).toEqual([0, 1, 2]);
    expect(result.skipped).toBe(0);
  });

  it("skips changes that no longer fit instead of forcing them", () => {
    const result = applyChanges(plan, [
      { type: "remove", stopId: ID(77), reason: "gone" },
      { type: "move", stopId: ID(1), toDay: 9, reason: "no such day" },
      { type: "move", stopId: ID(1), toDay: 0, reason: "already there" },
      { type: "add", sourceKey: "osm:node/1", toDay: 1, reason: "already in trip" },
      { type: "add", sourceKey: "osm:node/404", toDay: 1, reason: "not saved" },
    ]);
    expect(result.skipped).toBe(5);
    expect(result.layout).toHaveLength(5);
    expect(result.touchedDays).toEqual([]);
  });
});

describe("rule-based requests", () => {
  it("finds the day a request means: numbers, ordinals, weekdays", () => {
    expect(findDay("make day 2 slower", plan)).toBe(1);
    expect(findDay("the third day is too much", plan)).toBe(2);
    expect(findDay("it's raining on Saturday", plan)).toBe(1);
    expect(findDay("last day", plan)).toBe(2);
  });

  it("refuses days outside the trip and requests with no day", () => {
    expect(findDay("day 9", plan)).toBeNull();
    expect(findDay("on Tuesday", plan)).toBeNull();
    expect(findDay("make it nicer", plan)).toBeNull();
  });

  it("finds a stop by its name or by enough of its words", () => {
    expect(findStop("remove the time out market", plan.stops)?.id).toBe(ID(3));
    expect(findStop("skip azulejo please", plan.stops)?.id).toBe(ID(4));
    expect(findStop("remove something", plan.stops)).toBeNull();
  });

  it("slows a day by moving its weakest stop to the roomiest other day", () => {
    const answer = ruleProposal("make day 1 slower", plan);
    expect(answer.changes).toEqual([
      expect.objectContaining({ type: "move", stopId: ID(2), toDay: 1 }),
    ]);
  });

  it("moves outdoor stops off a rainy day and brings indoor ones in", () => {
    const answer = ruleProposal("it's going to rain on Friday", plan);
    const moved = answer.changes.filter((c) => c.type === "move");
    expect(moved.some((c) => c.type === "move" && c.stopId === ID(1) && c.toDay !== 0)).toBe(true);
    expect(moved.some((c) => c.type === "move" && c.stopId === ID(4) && c.toDay === 0)).toBe(true);
  });

  it("asks which day when rain has no day, and adds saves on request", () => {
    expect(ruleProposal("what if it rains", plan).changes).toEqual([]);
    expect(ruleProposal("add more to day 3", plan).changes).toEqual([
      expect.objectContaining({ type: "add", sourceKey: "osm:node/9", toDay: 2 }),
    ]);
  });

  it("handles remove and move by name", () => {
    expect(ruleProposal("remove Belém Tower", plan).changes).toEqual([
      expect.objectContaining({ type: "remove", stopId: ID(5) }),
    ]);
    expect(ruleProposal("move the time out market to day 3", plan).changes).toEqual([
      expect.objectContaining({ type: "move", stopId: ID(3), toDay: 2 }),
    ]);
  });

  it("says honestly when it can't help", () => {
    const answer = ruleProposal("find me a romantic dinner", plan);
    expect(answer.changes).toEqual([]);
    expect(answer.summary).toMatch(/Without Compass/);
  });
});

describe("Compass answers", () => {
  it("maps short ids back to stops and saves, dropping anything that doesn't resolve", () => {
    const refs = planRefs(plan);
    expect(refs.stops[0]?.ref).toBe("s1");
    const changes = resolveProposal(
      {
        summary: "Lighter Friday",
        changes: [
          { action: "move", stop: "s2", day: 2, reason: "Room on Saturday." },
          { action: "add", save: "a1", day: 3, reason: "A museum you saved." },
          { action: "remove", stop: "s99", reason: "Unknown stop." },
          { action: "move", stop: "s1", day: 9, reason: "No such day." },
          { action: "move", stop: "s1", day: 1, reason: "Already there." },
          { action: "add", save: "a7", day: 1, reason: "Unknown save." },
        ],
      },
      plan,
    );
    expect(changes).toEqual([
      { type: "move", stopId: ID(2), toDay: 1, reason: "Room on Saturday." },
      { type: "add", sourceKey: "osm:node/9", toDay: 2, reason: "A museum you saved." },
    ]);
  });

  it("repairs an answer by dropping malformed items and trimming text", () => {
    const repaired = repairProposal({
      summary: "x".repeat(400),
      changes: [
        { action: "move", stop: " s1 ", day: 2.2, reason: "  fine  " },
        { action: "teleport", stop: "s1", reason: "unknown action" },
        "not an object",
        { action: "remove", reason: 5 },
      ],
    });
    const parsed = proposalAnswerSchema.parse(repaired);
    expect(parsed.summary).toHaveLength(240);
    expect(parsed.changes).toEqual([{ action: "move", stop: "s1", day: 2, reason: "fine" }]);
  });

  it("leaves unrepairable answers for validation to reject", () => {
    expect(repairProposal("nonsense")).toBe("nonsense");
    expect(proposalAnswerSchema.safeParse(repairProposal({ changes: "all" })).success).toBe(false);
    expect(dayTitlesSchema.safeParse(repairDayTitles({ titles: [{ day: 1 }] })).data).toEqual({
      titles: [],
    });
    expect(
      dayTitlesSchema.parse(repairDayTitles({ titles: [{ day: 1, title: "  Castle   hill " }] })),
    ).toEqual({ titles: [{ day: 1, title: "Castle hill" }] });
  });
});

describe("Mapbox Directions parsing", () => {
  const answer = {
    code: "Ok",
    routes: [
      {
        legs: [
          { duration: 612.4, distance: 803.2 },
          { duration: 300, distance: 410 },
        ],
        geometry: {
          coordinates: [
            [-9.133512345, 38.713912345],
            [-9.1336, 38.7099],
            [-9.14, 38.71],
          ],
        },
      },
    ],
  };

  it("turns an answer into rounded legs and a line", () => {
    expect(parseDirections(answer, 3)).toEqual({
      legs: [
        { seconds: 612, meters: 803 },
        { seconds: 300, meters: 410 },
      ],
      line: [
        [-9.13351, 38.71391],
        [-9.1336, 38.7099],
        [-9.14, 38.71],
      ],
    });
  });

  it("rejects errors, malformed answers and answers for a different number of stops", () => {
    expect(parseDirections({ code: "NoRoute", routes: [] }, 3)).toBeNull();
    expect(parseDirections({ code: "Ok", routes: [{ legs: "x" }] }, 3)).toBeNull();
    expect(parseDirections(null, 3)).toBeNull();
    expect(parseDirections(answer, 4)).toBeNull();
  });

  it("signs a route by mode and order", () => {
    expect(routeSignature(["osm:node/1", "osm:node/2"], "walking")).toBe(
      "walking:osm:node/1,osm:node/2",
    );
    expect(routeSignature(["osm:node/2", "osm:node/1"], "walking")).not.toBe(
      routeSignature(["osm:node/1", "osm:node/2"], "walking"),
    );
  });
});

describe("trip schemas", () => {
  it("accepts a valid compose form and rejects bad input", () => {
    expect(
      composeSchema.safeParse({
        cityId: "2267057",
        startDate: "2026-11-13",
        days: "3",
        pace: "slow",
      }).success,
    ).toBe(true);
    const bad = composeSchema.safeParse({
      cityId: "x",
      startDate: "13/11/2026",
      days: "40",
      pace: "warp",
    });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "cityId",
      "days",
      "pace",
      "startDate",
    ]);
  });

  it("rejects malformed layouts and changes", () => {
    expect(layoutSchema.safeParse([{ id: "not-a-uuid", day: 0, position: 0 }]).success).toBe(false);
    expect(layoutSchema.safeParse([{ id: ID(1), day: 20, position: 0 }]).success).toBe(false);
    expect(changesSchema.safeParse([{ type: "delete-everything" }]).success).toBe(false);
    expect(
      changesSchema.safeParse([{ type: "remove", stopId: ID(1), reason: "fine" }]).success,
    ).toBe(true);
  });
});
