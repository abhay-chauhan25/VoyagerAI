/**
 * Fills in missing values in the text of a .env file. A key that already has a value is never
 * changed, so running setup again cannot overwrite a token someone has added.
 * Returns the new text and the names (never the values) of the keys it filled.
 */
export function fillEnv(text, values) {
  const filled = [];
  const seen = new Set();
  const lines = text.split("\n").map((line) => {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) return line;
    const [, key, current] = match;
    seen.add(key);
    const wanted = values[key];
    if (current.trim() !== "" || wanted === undefined || wanted === "") return line;
    filled.push(key);
    return `${key}=${wanted}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (seen.has(key) || value === undefined || value === "") continue;
    // Keep the file's final newline last.
    if (lines.at(-1) === "") lines.splice(-1, 0, `${key}=${value}`);
    else lines.push(`${key}=${value}`);
    filled.push(key);
  }
  return { text: lines.join("\n"), filled };
}

/** Reads KEY=value or KEY="value" lines, as printed by `supabase status -o env`. */
export function parseEnv(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    values[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return values;
}
