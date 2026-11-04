import { hueFor, initialsFor } from "@/lib/user/initials";

describe("initialsFor", () => {
  it("uses first and last initials", () => {
    expect(initialsFor("Ana Sousa")).toBe("AS");
    expect(initialsFor("  kai  ")).toBe("K");
    expect(initialsFor("Élodie de la Cruz")).toBe("ÉC");
  });

  it("falls back for empty names", () => {
    expect(initialsFor("")).toBe("?");
    expect(initialsFor("   ")).toBe("?");
  });
});

describe("hueFor", () => {
  it("is stable and in range", () => {
    expect(hueFor("ana")).toBe(hueFor("ana"));
    for (const id of ["", "ana", "11111111-1111-4111-8111-111111111111"]) {
      const hue = hueFor(id);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});
