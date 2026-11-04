import { APP_HOME, isGuestOnlyPath, isProtectedPath, safeNextPath } from "@/lib/auth/routes";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/trips")).toBe("/trips");
    expect(safeNextPath("/atlas?country=PT")).toBe("/atlas?country=PT");
  });

  it("falls back when missing", () => {
    expect(safeNextPath(null)).toBe(APP_HOME);
    expect(safeNextPath(undefined)).toBe(APP_HOME);
    expect(safeNextPath("")).toBe(APP_HOME);
  });

  it("rejects anything that could leave the site", () => {
    for (const hostile of [
      "https://evil.example.com",
      "//evil.example.com/path",
      "/\\evil.example.com",
      "javascript:alert(1)",
      "trips",
      "/trips\n/evil",
    ]) {
      expect(safeNextPath(hostile)).toBe(APP_HOME);
    }
  });
});

describe("route groups", () => {
  it("protects app routes and their children", () => {
    expect(isProtectedPath("/trips")).toBe(true);
    expect(isProtectedPath("/trips/abc")).toBe(true);
    expect(isProtectedPath("/account")).toBe(true);
  });

  it("does not protect public routes or lookalikes", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
    expect(isProtectedPath("/tripsy")).toBe(false);
  });

  it("marks only sign-in and sign-up as guest-only", () => {
    expect(isGuestOnlyPath("/sign-in")).toBe(true);
    expect(isGuestOnlyPath("/sign-up")).toBe(true);
    expect(isGuestOnlyPath("/check-email")).toBe(false);
  });
});
