import "server-only";
import { z } from "zod";

/**
 * Server-only configuration. These values never reach the browser: `server-only` makes the build
 * fail if this module is imported from client code.
 */
const serverEnvSchema = z.object({
  // Optional: without a key, every AI feature uses its non-AI fallback.
  GEMINI_API_KEY: z.string().min(20).optional(),
  GEMINI_MODEL: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default("gemini-3.8-flash"),
  // Tried once when the main model is overloaded or rate-limited.
  GEMINI_FALLBACK_MODEL: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default("gemini-3.5-flash-lite"),
  AI_DAILY_LIMIT: z.coerce.number().int().min(0).max(1000).default(30),
  // "1" swaps Gemini, OpenStreetMap and Wikimedia for local fixtures (tests); never in normal use.
  VOYAGER_FIXTURES: z.enum(["0", "1"]).default("0"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment variables: ${fields}. See .env.example.`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
    AI_DAILY_LIMIT: process.env.AI_DAILY_LIMIT,
    VOYAGER_FIXTURES: process.env.VOYAGER_FIXTURES,
  });
  return cached;
}
