import { sortCircle, type Person } from "@/lib/friends/queries";
import { aboutSchema } from "@/lib/user/about";

function person(name: string, iFollow: boolean, followsMe: boolean): Person {
  return { id: name, name, handle: null, isPublic: false, iFollow, followsMe };
}

const BLANK = {
  bio: "",
  website: "",
  contactEmail: "",
  phone: "",
  emailAudience: "hidden",
  phoneAudience: "hidden",
};

describe("friends, following and followers", () => {
  it("makes friends of people who follow each other", () => {
    const circle = sortCircle([
      person("Ana", true, true),
      person("Ben", true, false),
      person("Kai", false, true),
    ]);
    expect(circle.friends.map((p) => p.name)).toEqual(["Ana"]);
    expect(circle.following.map((p) => p.name)).toEqual(["Ben"]);
    expect(circle.followers.map((p) => p.name)).toEqual(["Kai"]);
  });

  it("counts friends in both totals, as profiles usually do", () => {
    const { counts } = sortCircle([
      person("Ana", true, true),
      person("Ben", true, false),
      person("Kai", false, true),
    ]);
    expect(counts).toEqual({ friends: 1, following: 2, followers: 2 });
  });

  it("is all zeros for someone with no connections", () => {
    expect(sortCircle([]).counts).toEqual({ friends: 0, following: 0, followers: 0 });
  });
});

describe("profile details", () => {
  it("stores blank fields as nothing", () => {
    expect(aboutSchema.parse(BLANK)).toMatchObject({
      bio: null,
      website: null,
      contactEmail: null,
      phone: null,
    });
  });

  it("accepts a full, valid set and trims it", () => {
    const parsed = aboutSchema.parse({
      bio: "  Slow traveller.  ",
      website: "https://example.com/ana",
      contactEmail: "ana@example.com",
      phone: "+351 21 000 0000",
      emailAudience: "friends",
      phoneAudience: "followers",
    });
    expect(parsed.bio).toBe("Slow traveller.");
    expect(parsed.emailAudience).toBe("friends");
  });

  it("refuses links that aren't https, including script links", () => {
    for (const website of [
      "http://example.com",
      "javascript:alert(1)",
      "example.com",
      "https://",
    ]) {
      expect(aboutSchema.safeParse({ ...BLANK, website }).success).toBe(false);
    }
  });

  it("refuses malformed emails and phone numbers, an over-long bio and unknown audiences", () => {
    expect(aboutSchema.safeParse({ ...BLANK, contactEmail: "ana@" }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...BLANK, phone: "call me" }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...BLANK, phone: "12" }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...BLANK, bio: "x".repeat(281) }).success).toBe(false);
    expect(aboutSchema.safeParse({ ...BLANK, emailAudience: "everyone" }).success).toBe(false);
  });
});
