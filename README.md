# Voyager

An AI travel companion: it learns what you like, turns the places you save into day-by-day trips on a
map, and lets your friends plan with you.

Portfolio-grade prototype, built to run locally. See [`information.md`](information.md) for the
product blueprint and stage plan, and [`docs/architecture.md`](docs/architecture.md) for how it works.

## What works today

- Landing page with a live trip-brief demo (type a wish, read the structured brief).
- Accounts: sign up with email confirmation, sign in with a password or a one-time email link,
  sign out. Sessions are refreshed on every request; app pages are closed to guests.
- Profile (display name, home city) protected by row-level security.
- **Travel DNA**: a 12-scene swipe deck (drag, buttons or arrow keys) and three questions build an
  explained taste profile you can adjust.
- **Atlas**: a Mapbox globe of the countries and cities you've been to, with offline city search.
- **Public profiles** at `/u/<handle>`: opt-in, showing your Atlas and top interests.
- **Drift**: a daily deck of destinations picked by Compass (Gemini) for your Travel DNA, each
  checked against a real city list, with Commons photos and Wikivoyage/Wikipedia descriptions; a
  deck of real places per city (OpenStreetMap, or Wikipedia when OpenStreetMap is down); **Ask
  Compass** plain-language search on a globe; and a Saved list grouped by city. Every AI feature
  has a non-AI fallback and a per-user daily limit.
- **Trips (Trip Canvas + Compose)**: Compose turns a city's saves into a day-by-day plan: nearby
  places grouped into days by your pace, each day ordered around OpenStreetMap opening hours, travel
  times and street routes from Mapbox Directions (or labelled straight-line estimates). The canvas
  shows a timeline beside a map with each day in its own colour; drag stops within and between days
  (mouse, touch or keyboard), switch walk/drive, re-order a day, set price levels or exact amounts,
  and watch pace and budget meters. **Ask Compass** to change the trip ("make day 2 slower", "it's
  raining on Thursday") and accept or reject each proposed change; without AI a rule-based parser
  handles common requests. Asked to add places, Compass can also suggest real places in the city
  that you haven't saved, including places to eat.
- **Huddle**: share a trip by invite link (editor or viewer, 7 days, revocable) or by @handle.
  Members see who is here and which day they're on, and every change appears for everyone within a
  second (Supabase Realtime, on a private channel per trip). **Group Drift** deals the same deck to
  everyone; places all swipers loved become matches that can be voted on and added. **Consensus**
  drafts a plan balancing everyone's top interests at the slowest member's pace, explains the
  trade-offs, and goes to a vote like any proposal. Owners manage roles; viewers swipe and vote.
- **The plane**: an interactive 3D airliner (Three.js, built in code) is the way around the app.
  Each part opens a section: cockpit → Trips, main cabin → Huddle, rear galley → Travel DNA, wing →
  Drift, tail fin → Atlas, hold → Field Notes. Drag to look around, point at a part to see inside
  it, choose it to fly in. The sidebar still goes anywhere directly. Where 3D can't run smoothly
  (or reduced motion is on) the same links sit on a drawn plane, and a switch lets you pick either.
  The homepage opens on the same plane and walks through its parts as you scroll.
- **Field Notes**: rate a place from one of your trips, add a few words and up to four photos
  (5 MB each; location and camera details are removed in the browser before upload). Every note
  starts private; you choose per note whether followers or everyone on Voyager can see it. Follow
  travellers with public profiles. Publish a trip as a **story** (Compass can draft it for you to
  edit, or a plain template is used), and **fork** any story you can see into a trip of your own.
  A story shares places and days only.
- **Friends and profiles**: a Friends page shows your friends, following and follower counts, who
  to follow back, and public travellers you could follow (with search). Two people who follow each
  other are friends. Profiles can carry a bio, a link, and a contact email and phone number; each
  contact detail has its own setting (nobody, friends, followers, any signed-in traveller), starts
  hidden, and is never shown to visitors who aren't signed in. A profile also lists the notes and
  stories its owner has shared with you. Trip owners can invite a friend with one press.
- App shell with day/night/auto theme in the "Golden hour livery"
  palette, maps on Mapbox Standard lit for day or night.

## Requirements

- Node.js 22 or newer (developed on Node 26)
- Docker Desktop, running (local Supabase)

## Run it locally

```bash
npm run setup                    # installs, starts local Supabase, applies migrations, loads cities, prepares .env
# add your Mapbox public token (pk.…) as NEXT_PUBLIC_MAPBOX_TOKEN in .env
# optional: GEMINI_API_KEY in .env turns Compass on (see .env.example for model and limit settings)
# optional: MAPBOX_SERVER_TOKEN (a second public token, no URL restriction) gives real travel times
npm run dev                      # http://localhost:3000
npm run demo:seed                # optional: three synthetic travellers with a shared trip, notes and a story
```

`npm run setup` is safe to run again: it never resets the database and never changes a value already
in `.env`. The first run downloads Supabase's Docker images and the GeoNames city list (~3 MB).
[docs/demo.md](docs/demo.md) is a ten-minute walkthrough using the demo travellers.

After pulling new code, apply new migrations with `npm run db:migrate`. It keeps your accounts and
data; `npm run db:reset` wipes the local database, including every account.

Emails (confirmations, sign-in links) never leave your machine: open the local inbox at
<http://127.0.0.1:54324>. Supabase Studio is at <http://127.0.0.1:54323>.

## Checks

| Command                | What it runs                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint (Next.js, TypeScript, accessibility rules)                                                                                                   |
| `npm run format:check` | Prettier                                                                                                                                            |
| `npm run typecheck`    | `tsc --noEmit`, strict                                                                                                                              |
| `npm test`             | Vitest unit and component tests                                                                                                                     |
| `npm run test:db`      | pgTAP tests of database security (needs `db:start`)                                                                                                 |
| `npm run test:e2e`     | Playwright, desktop and phone, against local Supabase with AI and map services faked (`VOYAGER_FIXTURES=1`); stop any dev server on port 3000 first |
| `npm run build`        | Production build                                                                                                                                    |
| `npm run check`        | lint + format + typecheck + unit tests + build                                                                                                      |

Other scripts: `npm run setup` (one-command local setup), `npm run demo:seed` / `demo:clean` (demo
travellers), `npm run db:clean-tests` (removes the `e2e-…@example.com` accounts that end-to-end
tests leave in the local database), `npm run db:migrate` (apply new migrations, keeping data).

## Accessibility and performance

- Every main screen is scanned with axe (WCAG 2.2 A and AA rules) in the end-to-end suite, in both
  themes, and must come back with no violations. Automated scans find a limited class of problems;
  the app has not been audited with a screen reader by a person.
- Everything works from the keyboard: the plane's parts are ordinary links, trip stops can be
  dragged with space and the arrow keys, and Drift decks answer to the arrow keys.
- `prefers-reduced-motion` turns off the camera flight, the idle turning and the entrances, and
  shows the drawn plane by default.
- The 3D plane is a separate download, fetched only where it will run well. Measured on the
  production build of the homepage (compressed, over the network): 162 KB of scripts with the drawn
  plane and 407 KB with the 3D plane. The scene stops drawing when off screen or in a hidden tab,
  and steps down or hands over to the drawing if the device can't keep up.

## What this is, and isn't

Voyager is a portfolio prototype that runs on your own machine. It is not deployed, has no real
users, and has not had a security review or a load test. Known gaps: clashing edits on a shared trip
are refused rather than merged; there is no reporting or moderation for notes; orphaned photo files
are not cleaned up when an account is removed by hand; place data comes from free sources and is
uneven outside large cities.

CI (GitHub Actions) runs lint, format, typecheck, unit tests and build, plus the database tests on a
local Postgres. End-to-end tests run locally.

## Data and picture credits

- Cities: [GeoNames](https://www.geonames.org/) (CC BY 4.0). Country outlines: Natural Earth
  (public domain). Continents: GeoNames country info (CC BY 4.0).
- Maps and travel times: © Mapbox © OpenStreetMap.
- Opening hours: OpenStreetMap, evaluated with the `opening_hours` library.
- Drift places: © OpenStreetMap contributors (ODbL) and Wikipedia (CC BY-SA); descriptions from
  Wikivoyage/Wikipedia (CC BY-SA); photos from Wikimedia Commons, credited on each card.

### Pictures

The landing and sign-in pages use openly licensed photographs and public-domain maps of Lisbon from
Wikimedia Commons. Every credit is listed on the landing page footer and in
`public/images/landing/credits.json`; Travel DNA scene photos are credited in
`public/images/scenes/credits.json`.
