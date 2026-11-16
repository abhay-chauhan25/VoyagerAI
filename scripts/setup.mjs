#!/usr/bin/env node
/**
 * One-command local setup: `npm run setup`.
 *
 * Starts local Supabase, applies migrations, loads the city list if the database has none, and
 * prepares .env. It is safe to run again: it never resets the database and never changes a value
 * already in .env. Keys are written to .env; they are never printed.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fillEnv, parseEnv } from "./lib/env-file.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env");
const CITIES_SEED = join(ROOT, "supabase", "seed", "cities.sql");

function step(message) {
  console.log(`\n› ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", ...options });
  if (result.status !== 0) {
    console.error(`\nSetup stopped: \`${command} ${args.join(" ")}\` failed.`);
    process.exit(1);
  }
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

step("Checking Docker");
if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  console.error("Docker isn't running. Start Docker Desktop, then run `npm run setup` again.");
  process.exit(1);
}

step("Starting local Supabase (the first run downloads its images)");
// Its own output lists the local keys, so only errors are shown.
run("npx", ["supabase", "start"], { stdio: ["ignore", "ignore", "inherit"] });

step("Applying database migrations (existing accounts and data are kept)");
run("npx", ["supabase", "migration", "up"]);

step("Checking the city list");
const database = capture("docker", ["ps", "--format", "{{.Names}}"])
  .split("\n")
  .find((name) => name.startsWith("supabase_db"));
if (!database) {
  console.error("The Supabase database container isn't running.");
  process.exit(1);
}
const cityCount = Number(
  capture("docker", [
    "exec",
    database,
    "psql",
    "-U",
    "postgres",
    "-Atc",
    "select count(*) from public.cities",
  ]).trim(),
);
if (cityCount > 0) {
  console.log(`  ${cityCount} cities already loaded.`);
} else {
  if (!existsSync(CITIES_SEED)) {
    console.log("  Downloading the GeoNames city list (about 3 MB).");
    run("node", ["scripts/data/load-cities.mjs"]);
  }
  console.log("  Loading cities.");
  run("docker", ["exec", "-i", database, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: readFileSync(CITIES_SEED),
    stdio: ["pipe", "ignore", "inherit"],
  });
}

step("Preparing .env");
if (!existsSync(ENV_FILE)) copyFileSync(join(ROOT, ".env.example"), ENV_FILE);
const status = parseEnv(capture("npx", ["supabase", "status", "-o", "env"]));
const { text, filled } = fillEnv(readFileSync(ENV_FILE, "utf8"), {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
});
writeFileSync(ENV_FILE, text);
chmodSync(ENV_FILE, 0o600);
console.log(filled.length ? `  Filled in: ${filled.join(", ")}.` : "  Nothing to fill in.");

const env = parseEnv(readFileSync(ENV_FILE, "utf8"));
console.log("\nVoyager is set up.");
if (!env.NEXT_PUBLIC_MAPBOX_TOKEN)
  console.log(
    "  • Add your Mapbox public token (pk.…) to .env as NEXT_PUBLIC_MAPBOX_TOKEN to see maps.",
  );
if (!env.GEMINI_API_KEY)
  console.log(
    "  • Optional: add GEMINI_API_KEY to .env to turn Compass on. Without it Voyager uses its non-AI paths.",
  );
console.log("  • Start the app:        npm run dev   (http://localhost:3000)");
console.log("  • Optional demo data:   npm run demo:seed");
console.log("  • Local email inbox:    http://127.0.0.1:54324");
