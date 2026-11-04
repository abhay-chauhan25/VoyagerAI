# Architecture

## Layout

```text
src/
  app/
    page.tsx                 landing page (public)
    (auth)/                  sign-in, sign-up, check-email (public, guests only)
    (onboarding)/welcome     Travel DNA deck (signed-in, no app shell)
    (app)/                   drift, trips, atlas, notes, dna, account (signed-in, app shell)
    u/[handle]/              public profile (anyone, if the owner made it public)
    api/cities/route.ts      city typeahead (signed-in)
    auth/callback/route.ts   exchanges email-link codes for a session
    globals.css              design tokens (light + dark) and base styles
  components/
    ui/ shell/ landing/ auth/ account/ app/ brand/ theme/ credits/
    dna/                     swipe deck, onboarding flow, DNA editor, choice groups
    atlas/                   Mapbox globe, city search, add-place form, visit list, stats strip
  lib/
    env.ts                   validated public configuration
    interests.ts             the shared interest vocabulary
    supabase/                browser, server and proxy clients; generated DB types
    auth/                    zod schemas, server actions, route rules
    dna/                     scenes, scoring, schemas, queries, actions
    atlas/                   countries/continents, stats, camera maths, schemas, queries, actions
    brief/                   rule-based trip-wish parser
    user/                    current user, public profile lookup, initials and avatar hues
  proxy.ts                   runs on every request: session refresh + route guard
scripts/data/
  load-cities.mjs            GeoNames → supabase/seed/cities.sql (generated, not committed)
  build-geo.mjs              Natural Earth outlines + continent lookup (generated once, committed)
supabase/
  migrations/                SQL migrations (source of truth for the schema)
  tests/                     pgTAP tests of row-level security
tests/
  unit/                      Vitest
  e2e/                       Playwright (desktop + phone)
```

## Request flow

```text
request ─► proxy.ts ─► Supabase getClaims() (verifies the JWT, refreshes cookies)
              │ guest on app route ─► 307 /sign-in?next=<path>
              │ signed in on /sign-in or /sign-up ─► 307 /trips
              ▼
           page (Server Component)
              (app)/layout ─► requireUser(): getUser() asks the auth server, loads the profile
              ▼
           Supabase via the user's session ─► Postgres with RLS
```

The proxy is a convenience guard; `requireUser()` is the authoritative check, so a revoked session
is caught even if its cookie is still present.

## Authentication

- Email + password: `signUp` sends a confirmation email (confirmations are required). The link goes
  to Supabase, then to `/auth/callback?code=…`, which exchanges the one-time code (PKCE) for a session
  cookie and continues to `/welcome`, the Travel DNA deck.
- Magic link: `signInWithOtp` with `shouldCreateUser: false`, so links only sign in existing accounts.
  The response is identical whether or not the account exists (no email enumeration).
- Redirect targets pass through `safeNextPath()`, which accepts only same-site relative paths.

## Travel DNA

```text
/welcome deck (12 scenes: drag, buttons or arrow keys) + pace, budget, companions
   └─► saveOnboarding (server action, zod-validated)
         ├─► dna_reactions  (one row per scene: pass | love | more)
         └─► travel_dna     (weights from scoreReactions())
/dna ─► rankTraits(weights, reactions): interests by weight, each with the scenes that explain it
     ─► updateTravelDna: nudged weights (±0.25, clamped to [-1, 1]) and preferences
```

Scoring is deterministic: for each interest, the signal-weighted average of the reactions to the
scenes that signal it (`more` 1.5, `love` 1, `pass` −0.6), divided by at least one unit of evidence so
a scene that merely hints at an interest cannot max it out. Interests no scene touched stay unknown.

## Atlas

- `cities`: 34k GeoNames places (15,000+ people) with region names, loaded by the seed. Read-only for
  everyone. `search_cities(query)` ranks prefix matches first, then trigram similarity, then
  population; accents in the query are ignored.
- `visits`: a country, optionally a city, optionally a year. A trigger sets the country from the city
  so the two can never disagree. Unique per city and per country-only entry.
- The globe (`mapbox-gl`, globe projection) fills visited countries from Natural Earth outlines and
  draws cities as points. It opens centred on the traveller's places (spherical centroid, or fitted
  bounds when they are close together) and flies to each newly added city. The visible list is the
  accessible equivalent of the map.

## Database security

| Table           | Owner                                             | Others signed in | Visitors       |
| --------------- | ------------------------------------------------- | ---------------- | -------------- |
| `profiles`      | read; update name, home city, handle, public flag | read if public   | read if public |
| `travel_dna`    | read, insert, update                              | read if public   | read if public |
| `dna_reactions` | read, insert, update, delete                      | none             | none           |
| `visits`        | read, insert, delete                              | read if public   | read if public |
| `cities`        | read                                              | read             | read           |

- Every table has RLS on and explicit, column-level grants. `user_id` can appear in an update only
  because upserts re-send it; every policy pins it to the caller.
- `profile_is_public(id)` is a `SECURITY DEFINER` helper returning only a boolean, so child-table
  policies can check visibility for visitors who cannot read `profiles` rows themselves.
- Emails live in `auth.users` and are never exposed through these tables.
- `supabase/tests/*.test.sql` checks each rule, including the negative cases.

## Design system

Tokens in `src/app/globals.css` define roles, not colours: `bg`, `surface`, `ground`, `panel`, `ink`,
`muted`, `accent`, `primary`, status colours and motion curves. Dark mode redefines the same roles,
either from the system preference or a saved choice (`data-theme` on `<html>`, applied before first
paint by an inline script). The Mapbox globe reads the same tokens for its fills and atmosphere.

## Configuration

Validated at runtime by `src/lib/env.ts`:

| Variable                               | Notes                                                    |
| -------------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | local: `http://127.0.0.1:54321`                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser-safe by design; every table is protected by RLS  |
| `NEXT_PUBLIC_SITE_URL`                 | base for auth redirect links                             |
| `NEXT_PUBLIC_MAPBOX_TOKEN`             | optional; must be a public `pk.` token restricted by URL |

The Supabase secret / service-role key is not used by the app.
