import { parseServerEnv } from "@/lib/server-env";

describe("parseServerEnv", () => {
  it("applies defaults and treats empty values as unset", () => {
    expect(parseServerEnv({ GEMINI_API_KEY: "" })).toEqual({
      GEMINI_MODEL: "gemini-3.8-flash",
      GEMINI_FALLBACK_MODEL: "gemini-3.5-flash-lite",
      AI_DAILY_LIMIT: 30,
      VOYAGER_FIXTURES: "0",
    });
  });

  it("rejects malformed values without echoing them", () => {
    expect(() => parseServerEnv({ GEMINI_MODEL: "models/../evil" })).toThrow(/GEMINI_MODEL/);
    expect(() => parseServerEnv({ AI_DAILY_LIMIT: "-5" })).toThrow(/AI_DAILY_LIMIT/);
    expect(() => parseServerEnv({ GEMINI_API_KEY: "short-secret" })).toThrow(
      /^(?!.*short-secret).*GEMINI_API_KEY/,
    );
  });
});
