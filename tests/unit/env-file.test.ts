// @ts-expect-error -- a plain script module without type declarations
import { fillEnv, parseEnv } from "../../scripts/lib/env-file.mjs";

type Filled = { text: string; filled: string[] };
const fill = fillEnv as (text: string, values: Record<string, string | undefined>) => Filled;
const parse = parseEnv as (text: string) => Record<string, string>;

describe("filling in .env", () => {
  it("fills empty keys and says which, by name only", () => {
    const result = fill("# comment\nURL=\nTOKEN=\n", { URL: "http://127.0.0.1:54321" });
    expect(result.text).toBe("# comment\nURL=http://127.0.0.1:54321\nTOKEN=\n");
    expect(result.filled).toEqual(["URL"]);
  });

  it("never changes a value that is already there", () => {
    const text = "URL=http://mine.example.com\nTOKEN=pk.EXAMPLE\n";
    const result = fill(text, { URL: "http://127.0.0.1:54321", TOKEN: "other" });
    expect(result.text).toBe(text);
    expect(result.filled).toEqual([]);
  });

  it("adds a key the file doesn't have yet, and ignores empty or missing values", () => {
    const result = fill("A=1", { B: "2", C: "", D: undefined });
    expect(result.text).toBe("A=1\nB=2");
    expect(result.filled).toEqual(["B"]);
  });

  it("leaves comments, blank lines and malformed lines alone", () => {
    const text = "# URL=\n\nnot a setting\nlower=case\n";
    expect(fill(text, { URL: "x" }).text).toBe(`${text}URL=x\n`);
  });
});

describe("reading status output", () => {
  it("reads plain and quoted values and skips everything else", () => {
    expect(parse('API_URL="http://127.0.0.1:54321"\nPORT=54321\n\nStopped services: []\n')).toEqual(
      {
        API_URL: "http://127.0.0.1:54321",
        PORT: "54321",
      },
    );
  });

  it("returns nothing for empty or unrelated text", () => {
    expect(parse("")).toEqual({});
    expect(parse("supabase is not running")).toEqual({});
  });
});
