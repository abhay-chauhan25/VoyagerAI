import { parsePublicEnv } from "@/lib/env";

describe("parsePublicEnv", () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_EXAMPLEEXAMPLEEXAMPLE",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  };

  it("accepts a complete configuration", () => {
    expect(parsePublicEnv(valid)).toEqual(valid);
  });

  it("names every missing or malformed variable without echoing values", () => {
    expect(() =>
      parsePublicEnv({
        ...valid,
        NEXT_PUBLIC_SUPABASE_URL: "not a url",
        NEXT_PUBLIC_SITE_URL: undefined,
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SITE_URL/);
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "short" }),
    ).toThrow(/^(?!.*short).*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});
