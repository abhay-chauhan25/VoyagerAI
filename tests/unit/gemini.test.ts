import { ApiError } from "@google/genai";
import { z } from "zod";
import { generateJson, type GenerateFn } from "@/lib/ai/gemini";

const schema = z.object({ city: z.string().min(2) });
const prompt = { system: "s", user: "u" };

function fake(...responses: (string | Error)[]): GenerateFn & { models: string[] } {
  const models: string[] = [];
  const generate: GenerateFn = async (args) => {
    models.push(args.model);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { text: next };
  };
  return Object.assign(generate, { models });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("generateJson", () => {
  it("returns validated data from the main model", async () => {
    const generate = fake('{"city":"Lisbon"}');
    expect(await generateJson(schema, prompt, { generate })).toEqual({
      ok: true,
      data: { city: "Lisbon" },
      model: "gemini-3.8-flash",
    });
    expect(generate.models).toEqual(["gemini-3.8-flash"]);
  });

  it("tries the fallback model once when the main model is overloaded", async () => {
    const generate = fake(new ApiError({ message: "busy", status: 503 }), '{"city":"Porto"}');
    const result = await generateJson(schema, prompt, { generate });
    expect(result).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite" });
    expect(generate.models).toEqual(["gemini-3.8-flash", "gemini-3.5-flash-lite"]);
  });

  it("does not retry errors that a retry cannot fix", async () => {
    const generate = fake(
      new ApiError({ message: "bad request", status: 400 }),
      '{"city":"Porto"}',
    );
    expect(await generateJson(schema, prompt, { generate })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(generate.models).toHaveLength(1);
  });

  it("rejects malformed JSON and answers that fail the schema", async () => {
    expect(await generateJson(schema, prompt, { generate: fake("not json {") })).toEqual({
      ok: false,
      reason: "invalid-output",
    });
    expect(await generateJson(schema, prompt, { generate: fake('{"city":1}') })).toEqual({
      ok: false,
      reason: "invalid-output",
    });
    expect(await generateJson(schema, prompt, { generate: fake('{"town":"Lisbon"}') })).toEqual({
      ok: false,
      reason: "invalid-output",
    });
  });

  it("treats an empty answer as blocked", async () => {
    expect(await generateJson(schema, prompt, { generate: fake("") })).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("repairs an answer before validating it, but repair cannot invent a valid one", async () => {
    const repair = (json: unknown) => ({ city: String((json as { city: string }).city).trim() });
    expect(
      await generateJson(schema, { ...prompt, repair }, { generate: fake('{"city":"  Faro  "}') }),
    ).toMatchObject({
      ok: true,
      data: { city: "Faro" },
    });
    expect(
      await generateJson(schema, { ...prompt, repair }, { generate: fake('{"city":" "}') }),
    ).toEqual({
      ok: false,
      reason: "invalid-output",
    });
  });

  it("gives up after the timeout and tries the fallback", async () => {
    vi.useFakeTimers();
    const generate = vi.fn<GenerateFn>((args) =>
      args.model === "gemini-3.8-flash"
        ? new Promise(() => {})
        : Promise.resolve({ text: '{"city":"Braga"}' }),
    );
    const pending = generateJson(schema, prompt, { generate });
    await vi.advanceTimersByTimeAsync(12_001);
    expect(await pending).toMatchObject({ ok: true, data: { city: "Braga" } });
    vi.useRealTimers();
  });

  it("is disabled without a key or an injected client", async () => {
    expect(await generateJson(schema, prompt)).toEqual({ ok: false, reason: "disabled" });
  });
});
