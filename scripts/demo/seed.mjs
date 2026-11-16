#!/usr/bin/env node
/**
 * Demo data for a local Voyager: `npm run demo:seed`.
 *
 * Creates three synthetic travellers (Ana, Ben and Kai, @example.com) the same way a person would:
 * signing up, confirming by the email in the local inbox, and then writing their own rows through
 * the app's normal row-level security. No admin key is used. Their shared password is random, made
 * here, and written to a git-ignored file next to this project rather than printed.
 *
 * Places are real Lisbon landmarks; their ids are made up (990000001 and up) because the demo
 * doesn't call OpenStreetMap or Wikipedia.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ACCOUNTS_FILE = join(ROOT, "demo-accounts.local.txt");
const MAILPIT = "http://127.0.0.1:54324";
const LISBON = 2267057;

process.loadEnvFile(join(ROOT, ".env"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) fail("Run `npm run setup` first: .env has no Supabase URL or key.");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url))
  fail("Demo data is only for a local Supabase. NEXT_PUBLIC_SUPABASE_URL points somewhere else.");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function check(result, doing) {
  if (result.error) fail(`${doing} failed: ${result.error.message}`);
  return result.data;
}

const PEOPLE = [
  {
    key: "ana",
    name: "Ana",
    handle: "demo_ana",
    dna: { pace: "slow", budget: "comfortable", companions: ["friends"] },
    weights: { Food: 0.9, Viewpoints: 0.8, History: 0.6, Markets: 0.5, Nightlife: -0.4 },
  },
  {
    key: "ben",
    name: "Ben",
    handle: "demo_ben",
    dna: { pace: "full", budget: "shoestring", companions: ["friends"] },
    weights: { Museums: 0.9, Art: 0.8, Architecture: 0.7, Coffee: 0.4, Beaches: -0.3 },
  },
  {
    key: "kai",
    name: "Kai",
    handle: "demo_kai",
    dna: { pace: "balanced", budget: "comfortable", companions: ["partner"] },
    weights: { Nightlife: 0.8, Music: 0.8, Food: 0.6, Shopping: 0.3, Hiking: -0.5 },
  },
];

function place(n, name, slug, category, interests, latitude, longitude, why) {
  return {
    kind: "activity",
    sourceKey: `wikipedia:${990000000 + n}`,
    dataSource: "Wikipedia",
    sourceUrl: `https://en.wikipedia.org/wiki/${slug}`,
    cityId: LISBON,
    cityName: "Lisbon",
    name,
    category,
    interests,
    latitude,
    longitude,
    openingHours: null,
    website: null,
    why,
    photo: null,
  };
}

const PLACES = [
  place(
    1,
    "Castelo de São Jorge",
    "São_Jorge_Castle",
    "Castle",
    ["History", "Viewpoints"],
    38.7139,
    -9.1335,
    "A hilltop castle with the widest view over the city.",
  ),
  place(
    2,
    "Miradouro de Santa Luzia",
    "Alfama",
    "Viewpoint",
    ["Viewpoints"],
    38.7118,
    -9.1303,
    "A tiled terrace looking over Alfama's rooftops.",
  ),
  place(
    3,
    "Praça do Comércio",
    "Praça_do_Comércio",
    "Square",
    ["Architecture", "History"],
    38.7075,
    -9.1364,
    "The grand riverside square at the foot of Baixa.",
  ),
  place(
    4,
    "Mercado da Ribeira",
    "Mercado_da_Ribeira",
    "Market",
    ["Food", "Markets"],
    38.7071,
    -9.1459,
    "A market hall where the city's cooks share one roof.",
  ),
  place(
    5,
    "Torre de Belém",
    "Belém_Tower",
    "Monument",
    ["History", "Architecture"],
    38.6916,
    -9.216,
    "The river fort that ships once passed on their way out.",
  ),
  place(
    6,
    "Mosteiro dos Jerónimos",
    "Jerónimos_Monastery",
    "Monastery",
    ["Architecture", "History"],
    38.6979,
    -9.2068,
    "Carved stone cloisters from the age of sail.",
  ),
  place(
    7,
    "Museu Nacional do Azulejo",
    "National_Azulejo_Museum",
    "Museum",
    ["Museums", "Art"],
    38.725,
    -9.1139,
    "Five centuries of painted tiles in a former convent.",
  ),
];

async function confirmationLink(email) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    );
    if (!search.ok) fail("The local inbox isn't reachable. Is local Supabase running?");
    const newest = (await search.json()).messages[0];
    if (newest) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json();
      const match = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(message.HTML);
      if (match) return match[1].replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`No confirmation email arrived for ${email}.`);
}

async function traveller(person, password) {
  const email = `demo-${person.key}@example.com`;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  check(
    await client.auth.signUp({ email, password, options: { data: { display_name: person.name } } }),
    `Signing up ${person.name}`,
  );
  // Confirm exactly as a person would: by opening the link in the email.
  await fetch(await confirmationLink(email), { redirect: "manual" });
  const session = check(
    await client.auth.signInWithPassword({ email, password }),
    `Signing in ${person.name}`,
  );
  const id = session.user.id;
  check(
    await client
      .from("profiles")
      .update({ handle: person.handle, is_public: true, home_city: "Lisbon" })
      .eq("id", id),
    "Setting the profile",
  );
  check(
    await client
      .from("travel_dna")
      .insert({ user_id: id, ...person.dna, interest_weights: person.weights }),
    "Saving Travel DNA",
  );
  check(
    await client.from("visits").insert({ country_code: "PT", city_id: LISBON, visited_year: 2026 }),
    "Adding to the Atlas",
  );
  return { client, id, person };
}

if (existsSync(ACCOUNTS_FILE)) {
  console.log(`Demo data is already in place. Sign-in details are in ${ACCOUNTS_FILE}.`);
  console.log("To start over: npm run demo:clean, then npm run demo:seed.");
  process.exit(0);
}

const password = randomBytes(12).toString("base64url");
console.log("Creating Ana, Ben and Kai…");
const people = [];
for (const person of PEOPLE) people.push(await traveller(person, password));
const [a, b, k] = people;

console.log("Composing Ana's trip and sharing it with Ben…");
const days = [
  { day_index: 0, title: "Alfama and the river", mode: "walking", stops: [0, 1, 2, 3] },
  { day_index: 1, title: "Belém", mode: "walking", stops: [4, 5] },
  { day_index: 2, title: "Tiles", mode: "walking", stops: [6] },
];
const tripId = check(
  await a.client.rpc("create_trip", {
    p_trip: {
      city_id: LISBON,
      title: "Three slow days in Lisbon",
      start_date: "2027-04-09",
      day_count: 3,
      pace: "slow",
      budget: "comfortable",
      currency: "EUR",
    },
    p_days: days.map(({ day_index, title, mode }) => ({
      day_index,
      title,
      title_source: "rules",
      mode,
    })),
    p_stops: days.flatMap((day) =>
      day.stops.map((index, position) => ({
        day_index: day.day_index,
        position,
        source_key: PLACES[index].sourceKey,
        place: PLACES[index],
        dwell_minutes: 75,
        price_level: 1,
      })),
    ),
  }),
  "Creating the trip",
);
check(
  await a.client.rpc("invite_by_handle", {
    p_trip: tripId,
    p_handle: b.person.handle,
    p_role: "editor",
  }),
  "Inviting Ben",
);
const invitations = check(await b.client.rpc("my_trip_invitations"), "Reading Ben's invitations");
check(
  await b.client.rpc("respond_to_trip_invitation", { p_invite: invitations[0].id, p_accept: true }),
  "Joining the trip",
);

console.log("Writing notes, a story and follows…");
const note = (index, rating, body, visibility) => ({
  trip_id: tripId,
  source_key: PLACES[index].sourceKey,
  place_name: PLACES[index].name,
  city_name: "Lisbon",
  rating,
  body,
  visibility,
});
check(
  await a.client
    .from("notes")
    .insert([
      note(
        1,
        5,
        "Come just before sunset and bring something to drink. The terrace fills up, but people drift on after the light goes.",
        "public",
      ),
      note(
        3,
        4,
        "Good for a group that can't agree on dinner: everyone orders from a different counter and you share a table.",
        "public",
      ),
      note(
        0,
        3,
        "Worth it for the walls and the view. The queue at midday is long; go when it opens.",
        "followers",
      ),
    ]),
  "Writing Ana's notes",
);
check(
  await b.client
    .from("notes")
    .insert([
      note(
        6,
        5,
        "Easy to spend two hours here. The big panorama of the city before the earthquake is upstairs; don't miss it.",
        "public",
      ),
    ]),
  "Writing Ben's note",
);
check(
  await a.client.rpc("publish_trip_story", {
    p_trip: tripId,
    p_title: "Three slow days in Lisbon",
    p_body:
      "We kept the days short on purpose. The first stayed in Alfama: the castle in the morning, the Santa Luzia terrace, then down to the river and the market for a long lunch.\n\nBelém got a day to itself, the tower and then the monastery, with nothing booked after.\n\nThe last day was only the tile museum, and it was enough.",
    p_visibility: "public",
  }),
  "Publishing the story",
);
check(await b.client.from("follows").insert({ followee_id: a.id }), "Ben following Ana");
check(
  await k.client.from("follows").insert([{ followee_id: a.id }, { followee_id: b.id }]),
  "Kai following Ana and Ben",
);

writeFileSync(
  ACCOUNTS_FILE,
  [
    "Voyager demo accounts (local only, synthetic). This file is git-ignored.",
    "",
    ...PEOPLE.map((person) => `${person.name}: demo-${person.key}@example.com`),
    "",
    `Password for all three: ${password}`,
    "",
  ].join("\n"),
);
chmodSync(ACCOUNTS_FILE, 0o600);
console.log(`Done. Sign-in details are in ${ACCOUNTS_FILE}.`);
console.log(
  "Ana owns a shared Lisbon trip, notes and a public story; Ben is its editor; Kai follows both.",
);
