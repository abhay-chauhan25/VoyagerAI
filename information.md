# Voyager — project blueprint

Voyager is an AI travel companion: it learns what a traveller likes, turns the places they save into
realistic day-by-day trips on a map, and lets friends plan those trips together.

This file is the source of truth for product direction, architecture and the stage plan. Read it
before proposing or implementing work. Update it when a decision changes.

Status: portfolio-grade prototype, run locally. Not deployed, not production-hardened.

---

## 1. Product

The idea: one AI companion, **Compass**, follows the traveller through four moments —
**Dream → Shape → Gather → Remember** — and every screen is a view of the same trip.

| Area                        | What it is                                                                                                                                                                                                                                                         | What makes it different                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Travel DNA** (profile)    | Onboarding by swiping vivid scenes instead of ticking boxes; a taste profile that keeps learning from swipes, ratings and finished trips.                                                                                                                          | Transparent and editable: the user can see _why_ Voyager thinks they like something and correct it.                                                                          |
| **Drift** (discovery)       | A card deck of destinations and activities: left to pass, right to save, up for "more like this". Each card says why it was dealt. Beside it, a natural-language search ("somewhere warm in March, under €1.5k, great food") answered with a short set on a globe. | Every AI suggestion is grounded against a real places database before it is shown, so it cannot invent places.                                                               |
| **Trip Canvas** (planning)  | A day-by-day timeline synced to a map; drag stops between days. **Compose** turns saves into a draft plan that clusters nearby places, respects opening hours and real travel times, with a budget meter and a pace meter.                                         | **AI proposes, the user decides.** "Make day 2 slower" or "it's raining Thursday" returns a visible list of changes to accept or reject. The AI never edits a plan directly. |
| **Huddle** (group)          | Shared trips with live presence. **Group Drift**: everyone swipes the same deck and matches surface. **Consensus** drafts a plan that balances everyone's Travel DNA and explains the trade-offs.                                                                  | Turns a group chat into a decision you can see.                                                                                                                              |
| **Atlas** (map of travels)  | A personal world map that fills in as you travel; doubles as the public profile.                                                                                                                                                                                   | Finished trips add their stops automatically.                                                                                                                                |
| **Field Notes** (community) | Ratings, photos and stories tied to real places and trips; private until the author shares them.                                                                                                                                                                   | **Fork a trip**: copy any public itinerary into your own canvas and Compass adapts it to your taste, budget and dates.                                                       |

Deliberately out of scope: booking (links out instead), generic social posting, deployment.

## 2. Design direction

Direction **"Boarding"**: Voyager is one flight. A live 3D airliner is the signature way around
the app, and the homepage opens on the same plane in flight.

- **The plane** (`/board`): built in code with Three.js and React Three Fiber, not loaded from a
  model file. Each part opens a section: cockpit → Trips (Compose), main cabin → Huddle, rear galley
  → Travel DNA, wing → Drift, tail fin → Atlas, hold → Field Notes. Pointing at a part turns that
  stretch of skin to glass and lights the inside; choosing it flies the camera in, and the page opens
  under a short cover. The sidebar stays for direct navigation and shows a small drawing of the
  plane with the current part lit. Devices that can't run 3D smoothly, reduced motion and data-saver
  get the same markers on a drawn cutaway; a 3D/Drawing switch remembers a traveller's own choice.
- **Palette "Golden hour livery"** (replaced "Postcards" when the owner asked for a premium travel
  look): warm paper (`#f0e8da`, panels a tone step off it, never white) by day and dusk navy
  (`#0d1326`) by night, with dusk-navy ink. Six travel hues (cobalt, sea, vermilion, saffron, rose,
  moss) encode things, never decoration: each trip day (its chip, pins and route match), each
  interest family, and each section together with its part of the plane. They are also the stripes
  on the tail. Brass is the livery's one decorative line.
- **Maps**: Mapbox Standard, lit as day or night to follow the theme, with stars around the globe.
- **Type**: Bodoni Moda for display and the wordmark; Literata for all text, including the app UI;
  B612 Mono (drawn for aircraft cockpit displays) for the codes printed on passes.
- **Public pages**: the homepage is the plane over a cloud deck with the headline, then a pinned
  walk through its parts, then real photographs of the sample destination (openly licensed, credited
  in the footer) and product fragments built in HTML.
- **App screens**: open-plane shell (labelled sidebar on desktop, bottom tabs on phones), neutral
  active state, accent reserved for data and at most one control, dusk-navy primary button, honest
  empty states that keep their frame. Boarding-pass rows (a ticket with a perforated stub) list the
  parts of the plane; Huddle shows each trip's travellers as a row of seats.
- **Motion**: strong ease-out curves, 140–240 ms for UI responses, press feedback at scale 0.97.
  The one long movement is the camera flying into a part of the plane (under a second, mouse and
  touch only; keyboard choices open at once). Drift cards tilt on a spring, trip routes draw
  themselves in, pins lift when their stop is pointed at, and the idle Atlas globe turns slowly.
  Everything respects `prefers-reduced-motion`.

Tokens live in `src/app/globals.css`; components reference roles (`bg`, `ink`, `accent`…), never hex.

## 3. Architecture

```text
Browser ──► Next.js 16 (App Router, React 19, TypeScript strict)
              │  proxy.ts: refresh session cookie, guard app routes
              │  Server Components / Server Actions: all data access
              ▼
           Supabase (local, Docker)
              Postgres (+ PostGIS later) with row-level security on every table
              Auth (email + password, magic link; PKCE)
              Storage (photos, later) · Realtime (Huddle, later)
              Mailpit (captures auth emails locally)

Later stages add, server-side only:
  Gemini API (Compass)  ·  free place data (OpenStreetMap, Wikipedia/Wikivoyage, Wikimedia
  Commons, GeoNames) for grounding  ·  Mapbox (maps, travel times)
  Open-Meteo (weather, no key)
```

Principles:

- One deployable app; no separate backend service, no queues, no cache servers unless a real need
  appears.
- **Security in the database**: every table has RLS on and narrow grants; the browser only ever holds
  the publishable key. No service-role key in the app.
- **AI is advisory**: model output is validated against a zod schema, never applied without the
  user's confirmation, and every AI feature has a non-AI fallback. Per-user daily AI quotas and
  response caching keep the Gemini free tier within limits.
- Secrets live in a gitignored `.env` (chmod 600). Only `NEXT_PUBLIC_*` values that are designed to
  be public (Supabase publishable key, Mapbox public token restricted by URL) reach the browser.

## 4. Decisions log

| Decision   | Choice                                                                                                                                                                                                                                                                      | Why                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 + TypeScript                                                                                                                                                                                                                                                     | One app for UI and server code; Server Actions keep secrets server-side.                                                                                                                                  |
| Backend    | Supabase only (no Firebase)                                                                                                                                                                                                                                                 | Relational data, RLS, PostGIS, Realtime, local Docker stack.                                                                                                                                              |
| Hosting    | Local only                                                                                                                                                                                                                                                                  | The owner does not plan to deploy.                                                                                                                                                                        |
| Sign-in    | Email + password and magic link                                                                                                                                                                                                                                             | Works fully offline with local Supabase; no OAuth setup.                                                                                                                                                  |
| AI         | Gemini API: `gemini-3.8-flash`, falling back once to `gemini-3.5-flash-lite` when overloaded                                                                                                                                                                                | Owner's choice. 3.8 Flash returned "overloaded" (503) often in testing, so one retry on a lighter model, then a non-AI path. Free-tier prompts may be used by Google; only synthetic data in development. |
| Places     | Free sources only: GeoNames (cities, local); OpenStreetMap via Overpass (places, opening hours; main server, then a mirror); Wikipedia nearby search (fallback when Overpass is down); Wikivoyage/Wikipedia (descriptions); Wikimedia Commons (photos, Commons-hosted only) | Owner's rule: no paid place APIs. All free and openly licensed; responses cached in memory for a day; every photo and text credited.                                                                      |
| Maps       | Mapbox GL JS                                                                                                                                                                                                                                                                | Globe projection, styles, directions/matrix.                                                                                                                                                              |
| TypeScript | 6.0.3                                                                                                                                                                                                                                                                       | typescript-eslint supports `<6.1`; TypeScript 7 is not yet supported by the linter.                                                                                                                       |

## 5. Data model (planned; grows per stage)

- `profiles` — one per user (display name, home city, handle, public flag). Created by trigger on sign-up. **(built)**
- `travel_dna` — interest weights, pace, budget band, companions. **(built)**
- `dna_reactions` — each onboarding answer, kept to explain traits. **(built)**
- `saves` — a traveller's Drift verdicts, each with a snapshot of the card (place details, photo credit). Per user by design: there is no shared, writable place cache, so the app never needs an admin key. **(built)**
- `drift_decks` — today's cached deck per traveller and deck (destinations, or a city's places). **(built)**
- `ai_usage` — AI calls per traveller per day, written only through `consume_ai_quota()`. **(built)**
- `trips`, `trip_days` (title, travel mode, cached route), `trip_stops` (place snapshot, visit length, price level, optional amount). Owner-only for now. **(built)**
- `trip_members` (role: owner/editor/viewer), `trip_invites` (hashed link secrets), `trip_person_invites` (by handle). **(built)**
- `proposals` — change sets from Compass (or the rule-based fallback) awaiting accept/reject. **(built)**
- `trip_votes` — for/against on proposals and places; `group_decks`, `group_swipes` — Group Drift. **(built)**
- `cities` — GeoNames reference list (34k places, 15,000+ people), loaded locally. **(built)**
- `visits` — Atlas entries (country, optional city, optional year). **(built)**
- `notes`, `note_photos`, `follows` — Field Notes.

## 6. Stages

Each stage ends with checks passing, one commit, a push and a report, then waits for approval.

| #   | Stage                        | Outcome                                                                                                                                                                                                                                            |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Foundation**               | Next.js + TypeScript, design system, local Supabase, email/password + magic-link auth, profiles with RLS, app shell, landing page, lint/format/typecheck/unit/e2e/DB tests, CI.                                                                    |
| 2   | **Travel DNA + Atlas**       | Swipe-based taste onboarding, editable profile and preferences, interactive Mapbox world map of visited places, public profile page.                                                                                                               |
| 3   | **Drift + Compass AI layer** | Gemini-backed destination/activity cards grounded in free place data (GeoNames, OpenStreetMap, Wikivoyage, Commons photos), swipe deck, natural-language search on a globe, saves. Schema validation, fallbacks, caching, per-user quotas.         |
| 4   | **Trip Canvas + Compose**    | Trips, day timeline linked to the map, drag and drop, AI-composed itineraries using real travel times, budget and pace meters, accept/reject proposals. **MVP complete.**                                                                          |
| 5   | **Huddle**                   | Invites and roles, live co-editing with presence, Group Drift, voting, Consensus planning.                                                                                                                                                         |
| 6   | **Field Notes**              | Follows, reviews, ratings, photo uploads, feed, Fork-a-trip, AI-drafted trip stories.                                                                                                                                                              |
| 7   | **Polish**                   | Design half done early at the owner's request (the plane, the homepage, the "Golden hour livery" system). Remaining: accessibility and performance passes, full end-to-end coverage, demo seed data, docs, one-command local setup. No deployment. |

**MVP**: sign up → build Travel DNA → swipe and save in Drift → Compose a trip → view and edit it on
the map. Working at the end of Stage 4.

## 7. Accounts and keys needed

| When    | What                                                                            | Where it goes                          |
| ------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| Stage 1 | Docker Desktop running                                                          | —                                      |
| Stage 2 | Mapbox account, **public** token (`pk.…`) restricted to `http://localhost:3000` | `.env`: `NEXT_PUBLIC_MAPBOX_TOKEN`     |
| Stage 3 | Gemini API key (Google AI Studio)                                               | `.env`: `GEMINI_API_KEY` (server only) |
| Stage 4 | Optional second Mapbox public token, default scopes, no URL restriction         | `.env`: `MAPBOX_SERVER_TOKEN` (server) |
