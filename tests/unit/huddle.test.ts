import {
  consensusPlan,
  findMatches,
  groupPace,
  groupWeights,
  groupWhy,
  memberScore,
  nameList,
  planChanges,
  toMember,
  type Member,
  type PoolPlace,
} from "@/lib/huddle/group";
import { hashInviteToken, INVITE_TOKEN, newInviteToken } from "@/lib/huddle/tokens";
import type { HoursCheck } from "@/lib/trips/schedule";

const ana: Member = { id: "a", name: "Ana", pace: "balanced", top: ["Food", "Wine", "Art"] };
const ben: Member = { id: "b", name: "Ben", pace: "slow", top: ["Museums", "History", "Food"] };
const kai: Member = { id: "k", name: "Kai", pace: null, top: [] };

describe("group fit", () => {
  it("scores a place by a member's best-ranked top interest", () => {
    expect(memberScore(["Food"], ana)).toBe(1);
    expect(memberScore(["Art", "Wine"], ana)).toBe(0.8);
    expect(memberScore(["Hiking"], ana)).toBe(0);
    expect(memberScore(["Food"], kai)).toBe(0);
  });

  it("blends top interests and picks the slowest pace", () => {
    expect(groupWeights([ana, ben])).toEqual({
      Food: 0.8,
      Wine: 0.4,
      Art: 0.3,
      Museums: 0.5,
      History: 0.4,
    });
    expect(groupWeights([])).toEqual({});
    expect(groupPace([ana, ben])).toBe("slow");
    expect(groupPace([kai])).toBe("balanced");
  });

  it("explains a shared card from who it suits, never inventing", () => {
    expect(groupWhy(["Food"], [ana, ben])).toBe("Everyone here loves Food.");
    expect(groupWhy(["Museums"], [ana, ben])).toBe("Ben loves Museums.");
    expect(groupWhy(["Hiking"], [ana, ben])).toBe("Something different for the group.");
    expect(nameList(["Ana", "Ben", "Kai"])).toBe("Ana, Ben and Kai");
  });

  it("reads members from the database, dropping unknown interests", () => {
    expect(
      toMember({
        user_id: "x",
        display_name: "Dee",
        pace: "full",
        top_interests: ["Food", "Juggling", "Art", "Wine"],
      }).top,
    ).toEqual(["Food", "Art", "Wine"]);
  });
});

describe("Group Drift matches", () => {
  it("matches places everyone who swiped loved, with at least two fans", () => {
    expect(
      findMatches([
        { userId: "a", sourceKey: "osm:node/1", verdict: "love" },
        { userId: "b", sourceKey: "osm:node/1", verdict: "more" },
        { userId: "a", sourceKey: "osm:node/2", verdict: "love" },
        { userId: "a", sourceKey: "osm:node/3", verdict: "love" },
        { userId: "b", sourceKey: "osm:node/3", verdict: "love" },
        { userId: "k", sourceKey: "osm:node/3", verdict: "pass" },
      ]),
    ).toEqual([{ sourceKey: "osm:node/1", fans: ["a", "b"] }]);
  });

  it("finds nothing in no swipes", () => {
    expect(findMatches([])).toEqual([]);
  });
});

/** Real public landmarks in central Lisbon. */
function place(
  n: number,
  name: string,
  interests: PoolPlace["interests"],
  lat: number,
  lng: number,
): PoolPlace {
  return {
    key: `osm:node/${n}`,
    name,
    latitude: lat,
    longitude: lng,
    score: 0,
    dwell: 60,
    evening: false,
    hours: null,
    interests,
    lovedBy: 0,
  };
}
const open: HoursCheck = () => "open";
const pool = [
  place(1, "Time Out Market", ["Food"], 38.707, -9.146),
  place(2, "Taberna da Rua das Flores", ["Food"], 38.709, -9.143),
  place(3, "Wine bar", ["Wine"], 38.711, -9.141),
  place(4, "Restaurant Lisboa", ["Food"], 38.712, -9.139),
  place(5, "Museu Nacional de Arte Antiga", ["Museums", "Art"], 38.705, -9.161),
];

describe("Consensus", () => {
  it("gives every member a pick each day, at the slowest member's pace", () => {
    // Two food lovers outvote one museum lover on scores alone; the fairness pass swaps a museum in.
    const foodie: Member = {
      id: "a",
      name: "Ana",
      pace: "balanced",
      top: ["Food", "Wine", "Coffee"],
    };
    const cleo: Member = { id: "c", name: "Cleo", pace: "full", top: ["Food", "Wine", "Coffee"] };
    const curator: Member = {
      id: "b",
      name: "Ben",
      pace: "slow",
      top: ["Museums", "History", "Nature"],
    };
    const plan = consensusPlan([foodie, cleo, curator], pool, {
      days: 1,
      startDate: "2026-11-13",
      check: open,
    });
    expect(plan.pace).toBe("slow");
    expect(plan.days[0]).toHaveLength(3);
    expect(plan.days[0]).toContain("osm:node/5");
    expect(plan.notes[2]).toBe("Ben (Museums, History, Nature): 1 pick, at least one every day.");
    expect(plan.facts[0]).toBe("Paced for Ben: 3 stops a day.");
  });

  it("says plainly when a member has no pick on a day", () => {
    const plan = consensusPlan([ana, { ...ben, top: ["Hiking"] }], pool, {
      days: 1,
      startDate: "2026-11-13",
      check: open,
    });
    expect(plan.notes[1]).toMatch(/none fit on day 1\.$/);
  });

  it("turns a new plan into moves, removals and additions", () => {
    const current = [
      { id: "s1", sourceKey: "osm:node/1", day: 0 },
      { id: "s2", sourceKey: "osm:node/2", day: 0 },
      { id: "s3", sourceKey: "osm:node/3", day: 1 },
    ];
    const changes = planChanges(
      current,
      [["osm:node/1", "osm:node/3"], ["osm:node/5"]],
      (_, kind) => kind,
    );
    expect(changes).toEqual([
      { type: "remove", stopId: "s2", reason: "remove" },
      { type: "move", stopId: "s3", toDay: 0, reason: "move" },
      { type: "add", sourceKey: "osm:node/5", toDay: 1, reason: "add" },
    ]);
    expect(planChanges(current, [["osm:node/1", "osm:node/2"], ["osm:node/3"]], () => "x")).toEqual(
      [],
    );
  });
});

describe("invite tokens", () => {
  it("makes unguessable link-safe secrets and hashes them like the database", () => {
    const { token, hash } = newInviteToken();
    expect(token).toMatch(INVITE_TOKEN);
    expect(hash).toBe(hashInviteToken(token));
    expect(newInviteToken().token).not.toBe(token);
    // SHA-256 of "abc", the standard test vector.
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("rejects malformed secrets before any lookup", () => {
    expect(INVITE_TOKEN.test("short")).toBe(false);
    expect(INVITE_TOKEN.test("x".repeat(31) + "/")).toBe(false);
    expect(INVITE_TOKEN.test("'; drop table trips; --" + "x".repeat(9))).toBe(false);
  });
});
