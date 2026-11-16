#!/usr/bin/env node
/**
 * Removes synthetic accounts from the LOCAL database: the `e2e-…@example.com` travellers the
 * end-to-end tests create, and with `--demo` the three demo travellers too. Everything they own
 * (trips, notes, follows) goes with them. Real accounts are never matched.
 *
 * This talks to the local Supabase database container directly. It refuses to run if that
 * container isn't there, so it cannot be pointed at anything else.
 */
import { execFileSync } from "node:child_process";

const withDemo = process.argv.includes("--demo");
const pattern = withDemo ? "^(e2e-.+|demo-(ana|ben|kai))@example\\.com$" : "^e2e-.+@example\\.com$";

const database = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
  .split("\n")
  .find((name) => name.startsWith("supabase_db"));
if (!database) {
  console.error("Local Supabase isn't running (npm run db:start).");
  process.exit(1);
}

const removed = execFileSync(
  "docker",
  [
    "exec",
    database,
    "psql",
    "-U",
    "postgres",
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `with gone as (delete from auth.users where email ~ '${pattern}' returning 1) select count(*) from gone`,
  ],
  { encoding: "utf8" },
).trim();
console.log(`Removed ${removed} synthetic ${removed === "1" ? "account" : "accounts"}.`);
