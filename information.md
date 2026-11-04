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
| **Field Notes** (community) | Reviews, ratings, photos and stories tied to real places and trips.                                                                                                                                                                                                | **Fork a trip**: copy any public itinerary into your own canvas and Compass adapts it to your taste, budget and dates.                                                       |

Deliberately out of scope: booking (links out instead), generic social posting, deployment.

## 2. Design direction

Chosen with the taste-skill design process (direction "The split stage").

- **Palette "Stone and blueprint"**: stone paper `#dfdedb`, near-black ink `#26251e`, one blueprint-blue
  accent `#2456d6` — the colours of a chart table. Dark mode "Night Flight" keeps the same roles on a
  warm neutral near-black (no navy, by house rule).
- **Type**: Rokkitt 800 (slab capitals) for display and the wordmark — luggage tags, departure boards;
  Literata for all text, including the app UI.
- **Public pages** (landing, auth): square corners, one accent action, real photographs of the
  sample destination (openly licensed, credited in the footer), product fragments built in HTML.
- **App screens**: open-plane shell (labelled sidebar on desktop, bottom tabs on phones), neutral
  active state, accent reserved for data and at most one control, near-black primary button, honest
  empty states that keep their frame.
- **Motion**: strong ease-out curves, 140–240 ms for UI responses, press feedback at scale 0.97,
  section entrances, one slow photographic crossfade; everything respects `prefers-reduced-motion`.

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

| Decision   | Choice                                                                                                                                                                       | Why                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 + TypeScript                                                                                                                                                      | One app for UI and server code; Server Actions keep secrets server-side.                                                    |
| Backend    | Supabase only (no Firebase)                                                                                                                                                  | Relational data, RLS, PostGIS, Realtime, local Docker stack.                                                                |
| Hosting    | Local only                                                                                                                                                                   | The owner does not plan to deploy.                                                                                          |
| Sign-in    | Email + password and magic link                                                                                                                                              | Works fully offline with local Supabase; no OAuth setup.                                                                    |
| AI         | Gemini API (free tier)                                                                                                                                                       | Owner's choice. Free-tier prompts may be used by Google to improve products, so only synthetic data is used in development. |
| Places     | Free sources only: GeoNames (cities, local), OpenStreetMap via Overpass (points of interest, opening hours), Wikipedia/Wikivoyage (descriptions), Wikimedia Commons (photos) | Owner's rule: no paid place APIs. All are free and openly licensed; results are cached and credited.                        |
| Maps       | Mapbox GL JS                                                                                                                                                                 | Globe projection, styles, directions/matrix.                                                                                |
| TypeScript | 6.0.3                                                                                                                                                                        | typescript-eslint supports `<6.1`; TypeScript 7 is not yet supported by the linter.                                         |

## 5. Data model (planned; grows per stage)

- `profiles` — one per user (display name, home city, handle, public flag). Created by trigger on sign-up. **(built)**
- `travel_dna` — interest weights, pace, budget band, companions. **(built)**
- `dna_reactions` — each onboarding answer, kept to explain traits. **(built)**
- `places` — cached, grounded place records (provider id, name, location, hours, photo refs).
- `saves` — a user's Drift decisions (place, verdict, reason shown).
- `trips`, `trip_members` (role: owner/editor/viewer), `trip_days`, `trip_stops`.
- `proposals` — AI change sets awaiting accept/reject.
- `votes` — Huddle decisions.
- `cities` — GeoNames reference list (34k places, 15,000+ people), loaded locally. **(built)**
- `visits` — Atlas entries (country, optional city, optional year). **(built)**
- `notes`, `note_photos`, `follows` — Field Notes.

## 6. Stages

Each stage ends with checks passing, one commit, a push and a report, then waits for approval.

| #   | Stage                        | Outcome                                                                                                                                                                                                                                    |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Foundation**               | Next.js + TypeScript, design system, local Supabase, email/password + magic-link auth, profiles with RLS, app shell, landing page, lint/format/typecheck/unit/e2e/DB tests, CI.                                                            |
| 2   | **Travel DNA + Atlas**       | Swipe-based taste onboarding, editable profile and preferences, interactive Mapbox world map of visited places, public profile page.                                                                                                       |
| 3   | **Drift + Compass AI layer** | Gemini-backed destination/activity cards grounded in free place data (GeoNames, OpenStreetMap, Wikivoyage, Commons photos), swipe deck, natural-language search on a globe, saves. Schema validation, fallbacks, caching, per-user quotas. |
| 4   | **Trip Canvas + Compose**    | Trips, day timeline linked to the map, drag and drop, AI-composed itineraries using real travel times, budget and pace meters, accept/reject proposals. **MVP complete.**                                                                  |
| 5   | **Huddle**                   | Invites and roles, live co-editing with presence, Group Drift, voting, Consensus planning.                                                                                                                                                 |
| 6   | **Field Notes**              | Follows, reviews, ratings, photo uploads, feed, Fork-a-trip, AI-drafted trip stories.                                                                                                                                                      |
| 7   | **Polish**                   | Accessibility and performance passes, full end-to-end coverage, demo seed data, docs, one-command local setup. No deployment.                                                                                                              |

**MVP**: sign up → build Travel DNA → swipe and save in Drift → Compose a trip → view and edit it on
the map. Working at the end of Stage 4.

## 7. Accounts and keys needed

| When    | What                                                                            | Where it goes                          |
| ------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| Stage 1 | Docker Desktop running                                                          | —                                      |
| Stage 2 | Mapbox account, **public** token (`pk.…`) restricted to `http://localhost:3000` | `.env`: `NEXT_PUBLIC_MAPBOX_TOKEN`     |
| Stage 3 | Gemini API key (Google AI Studio)                                               | `.env`: `GEMINI_API_KEY` (server only) |
