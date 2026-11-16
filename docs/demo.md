# Demo walkthrough

A ten-minute tour of Voyager on your own machine, using synthetic travellers.

## Prepare

```bash
npm run setup        # once: local Supabase, migrations, cities, .env
npm run demo:seed    # creates Ana, Ben and Kai (@example.com) with a shared Lisbon trip
npm run dev          # http://localhost:3000
```

Sign-in details are written to `demo-accounts.local.txt` (git-ignored). The three travellers share
one random password made by the seed script. `npm run demo:clean` removes them again.

Maps need `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env`. Compass needs `GEMINI_API_KEY`; without it every
AI feature uses its non-AI path, and the demo still works.

## The tour

1. **Homepage.** Open `/` signed out. The plane flies behind the headline; scroll and the camera
   visits each part while a card explains the feature. Drag to turn the plane.
2. **Sign in as Ana**, then click the Voyager wordmark to reach **the plane** (`/board`). Point at
   parts: the hull turns to glass. Click the cockpit to fly into Trips. Try the 3D/Drawing switch.
3. **Trips → "Three slow days in Lisbon".** Timeline beside the map, each day in its own colour.
   Drag a stop to another day, switch a day to driving, open "Ask Compass" and type
   "make day 1 slower", then accept or reject the proposed changes.
4. **Huddle.** In a second browser profile (or a private window) sign in as **Ben**, who is an
   editor on the same trip. Open the trip in both windows: each shows "2 here now", and an edit in
   one appears in the other. Open Group Drift in both and swipe; places both love become matches.
   Ask for a Consensus plan and vote on it.
5. **Travel DNA.** As Ana, open the rear galley: interests with the reason for each, pace and
   budget. Nudge one and see the wording change.
6. **Drift.** Open the wing: destinations dealt for Ana's taste. Open a city and swipe its places;
   saved places become the raw material for Compose.
7. **Atlas.** Open the tail fin: a globe of visited places. `/u/demo_ana` is Ana's public profile.
8. **Field Notes.** Open the hold. "Mine" lists Ana's notes with who can see each. Sign in as
   **Kai** (who follows Ana and Ben): "Following" shows their shared notes; Ana's story appears
   too. Open it and press **Fork this trip** to copy it into Kai's own trips at Kai's pace.
9. **Privacy checks worth showing.** As Kai, Ana's followers-only note is visible but her trip
   itself is not (its address returns "not found"). Sign out: the story and notes are not public
   web pages.

## What is synthetic

The demo travellers, their notes and their story are made up. The Lisbon places are real
landmarks with made-up ids, because the seed does not call OpenStreetMap or Wikipedia.
