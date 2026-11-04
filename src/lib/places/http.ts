import "server-only";

/**
 * Wikimedia and OpenStreetMap ask automated clients to identify themselves with a contact. We use
 * the project's public repository, never a person's email.
 */
export const USER_AGENT = "VoyagerLocal/0.1 (+https://github.com/abhay-chauhan25/VoyagerAI)";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const DEFAULT_TIMEOUT_MS = 10_000;

type Entry = { expires: number; value: unknown };
const cache = new Map<string, Entry>();

/** Fair use: identical lookups within a day are answered from memory, not the free services. */
function remember(key: string, value: unknown) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + DAY_MS, value });
}

export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    readonly status: number | "timeout" | "network",
  ) {
    super(`${service} request failed (${status})`);
  }
}

/** GET or POST returning parsed JSON, cached for a day. Throws UpstreamError on any failure. */
export async function fetchJson(
  service: string,
  url: string,
  init: { method?: "GET" | "POST"; body?: string; contentType?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const key = `${init.method ?? "GET"} ${url} ${init.body ?? ""}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      body: init.body,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(init.contentType ? { "Content-Type": init.contentType } : {}),
      },
      signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    throw new UpstreamError(
      service,
      error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network",
    );
  }
  if (response.status === 404) {
    remember(key, null);
    return null;
  }
  if (!response.ok) throw new UpstreamError(service, response.status);
  const value: unknown = await response.json();
  remember(key, value);
  return value;
}

/** Runs async work over items with a small concurrency limit, to stay polite to free services. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}
