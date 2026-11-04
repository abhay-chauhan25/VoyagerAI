/** Route groups used by the proxy and the auth pages. Kept in one place so they cannot drift. */
export const APP_HOME = "/trips";
export const SIGN_IN_PATH = "/sign-in";

const PROTECTED_PREFIXES = ["/drift", "/trips", "/atlas", "/notes", "/account"] as const;
const AUTH_ONLY_FOR_GUESTS = ["/sign-in", "/sign-up"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_FOR_GUESTS.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * Accepts only same-site relative paths for post-auth redirects, so a crafted `next` parameter
 * cannot send a freshly signed-in user to another origin (open redirect).
 */
export function safeNextPath(raw: string | null | undefined, fallback: string = APP_HOME): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
