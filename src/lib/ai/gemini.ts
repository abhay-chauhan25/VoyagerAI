import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/lib/server-env";

export type AiFailure = "disabled" | "unavailable" | "timeout" | "invalid-output" | "blocked";
export type AiResult<T> = { ok: true; data: T; model: string } | { ok: false; reason: AiFailure };

export type JsonPrompt = {
  system: string;
  user: string;
  maxOutputTokens?: number;
  /**
   * Tidies a structurally sound answer before strict validation: drops individual bad items, trims
   * over-long text. It never invents content; anything it can't fix still fails validation.
   */
  repair?: (json: unknown) => unknown;
};

/** The SDK surface we use, so tests can substitute a fake. */
export type GenerateFn = (args: {
  model: string;
  contents: string;
  config: Record<string, unknown>;
}) => Promise<{ text?: string | undefined }>;

const TIMEOUT_MS = 12_000;
const RETRYABLE_STATUS = new Set([429, 500, 503]);

let client: GoogleGenAI | undefined;
function realGenerate(apiKey: string): GenerateFn {
  client ??= new GoogleGenAI({ apiKey });
  const models = client.models;
  return (args) => models.generateContent(args);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type Attempt<T> = { ok: true; data: T } | { ok: false; reason: AiFailure; retryable: boolean };

async function attempt<T>(
  generate: GenerateFn,
  model: string,
  schema: z.ZodType<T>,
  prompt: JsonPrompt,
): Promise<Attempt<T>> {
  let text: string | undefined;
  try {
    const response = await withTimeout(
      generate({
        model,
        contents: prompt.user,
        config: {
          systemInstruction: prompt.system,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema, { target: "draft-7" }),
          maxOutputTokens: prompt.maxOutputTokens ?? 2048,
          temperature: 0.7,
        },
      }),
      TIMEOUT_MS,
    );
    text = response.text;
  } catch (error) {
    if (error instanceof Error && error.message === "timeout")
      return { ok: false, reason: "timeout", retryable: true };
    const status = error instanceof ApiError ? error.status : undefined;
    console.error("Gemini request failed", { model, status });
    return {
      ok: false,
      reason: "unavailable",
      retryable: status !== undefined && RETRYABLE_STATUS.has(status),
    };
  }

  if (!text) return { ok: false, reason: "blocked", retryable: false };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("Gemini returned malformed JSON", { model, length: text.length });
    return { ok: false, reason: "invalid-output", retryable: false };
  }
  const parsed = schema.safeParse(prompt.repair ? prompt.repair(json) : json);
  if (!parsed.success) {
    // Field paths and issue codes only: never the model's text.
    const fields = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}:${issue.code}`);
    console.error("Gemini output failed validation", { model, fields });
    return { ok: false, reason: "invalid-output", retryable: false };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Asks Gemini for JSON matching `schema`. The answer is always validated; nothing unvalidated
 * leaves this function. On overload or rate limiting it tries the fallback model once. Expected
 * failures are returned, never thrown, so every caller can fall back to its non-AI path.
 */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  prompt: JsonPrompt,
  options: { generate?: GenerateFn } = {},
): Promise<AiResult<T>> {
  const env = serverEnv();
  if (!options.generate && !env.GEMINI_API_KEY) return { ok: false, reason: "disabled" };
  const generate = options.generate ?? realGenerate(env.GEMINI_API_KEY as string);

  const first = await attempt(generate, env.GEMINI_MODEL, schema, prompt);
  if (first.ok) return { ok: true, data: first.data, model: env.GEMINI_MODEL };
  if (!first.retryable || env.GEMINI_FALLBACK_MODEL === env.GEMINI_MODEL)
    return { ok: false, reason: first.reason };

  const second = await attempt(generate, env.GEMINI_FALLBACK_MODEL, schema, prompt);
  if (second.ok) return { ok: true, data: second.data, model: env.GEMINI_FALLBACK_MODEL };
  return { ok: false, reason: second.reason };
}
