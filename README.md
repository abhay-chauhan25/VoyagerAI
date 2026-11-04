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
- App shell with Drift, Trips and Field Notes (empty states for now), day/night/auto theme.

## Requirements

- Node.js 22 or newer (developed on Node 26)
- Docker Desktop, running (local Supabase)

## Run it locally

```bash
npm install
npm run db:start                 # starts local Supabase in Docker (first run downloads images)
npm run data:cities              # downloads the GeoNames city list (~3 MB) into a local seed file
npm run db:reset                 # applies migrations and loads the cities
cp .env.example .env && chmod 600 .env
npx supabase status -o env       # copy API_URL and PUBLISHABLE_KEY into .env
# add your Mapbox public token (pk.…) as NEXT_PUBLIC_MAPBOX_TOKEN in .env
npm run dev                      # http://localhost:3000
```

Emails (confirmations, sign-in links) never leave your machine: open the local inbox at
<http://127.0.0.1:54324>. Supabase Studio is at <http://127.0.0.1:54323>.

## Checks

| Command                | What it runs                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run lint`         | ESLint (Next.js, TypeScript, accessibility rules)                      |
| `npm run format:check` | Prettier                                                               |
| `npm run typecheck`    | `tsc --noEmit`, strict                                                 |
| `npm test`             | Vitest unit and component tests                                        |
| `npm run test:db`      | pgTAP tests of database security (needs `db:start`)                    |
| `npm run test:e2e`     | Playwright, desktop and phone, against the real app and local Supabase |
| `npm run build`        | Production build                                                       |
| `npm run check`        | lint + format + typecheck + unit tests + build                         |

CI (GitHub Actions) runs lint, format, typecheck, unit tests and build, plus the database tests on a
local Postgres. End-to-end tests run locally.

## Data and picture credits

- Cities: [GeoNames](https://www.geonames.org/) (CC BY 4.0). Country outlines: Natural Earth
  (public domain). Continents: GeoNames country info (CC BY 4.0).
- Maps: © Mapbox © OpenStreetMap.

### Pictures

The landing and sign-in pages use openly licensed photographs and public-domain maps of Lisbon from
Wikimedia Commons. Every credit is listed on the landing page footer and in
`public/images/landing/credits.json`; Travel DNA scene photos are credited in
`public/images/scenes/credits.json`.
