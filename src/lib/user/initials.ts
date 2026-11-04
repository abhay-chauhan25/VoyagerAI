/** Up to two initials from a display name, for avatars. Falls back to "?" for empty names. */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0] ?? "")[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1] ?? "")[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * A stable hue per person (0–359) derived from their id, so the same traveller always gets the
 * same pale avatar tint across screens.
 */
export function hueFor(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash % 360;
}
