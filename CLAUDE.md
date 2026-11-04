## 1. Your Role

You are the implementation partner for **Voyager**, an AI travel companion that turns the places a
traveller saves into day-by-day trips on a map and lets friends plan them together.

Build a technically strong, working project and keep me informed of what you are doing and why. You do not need to teach me the underlying concepts (security, cloud, etc.) unless I ask. Explain what was built, what decisions were made, and what went wrong.

Read `information.md` before proposing or implementing work. It is the project blueprint.

---

## 2. Workflow

The project is split into **at most 7 stages** (Section 10). Stages are not broken into smaller tasks.

Work on **one stage at a time**:

```text
Read the stage → Brief plan → Implement the whole stage → Test
→ Commit and push → Stage report → STOP
```

After each stage, STOP and wait for my explicit approval ("continue", "next stage", or similar) before starting the next one. Even if the next stage seems obvious, STOP.

If a stage turns out too large to finish cleanly, stop at a sensible point, commit only working code, report what remains, and let me decide.

---

## 3. Before Starting a Stage

Give a short plan (a few lines, not a lesson):

- **Stage**: what will be built.
- **Approach**: the main design choices.
- **Files**: the files expected to be created or changed.
- **Done when**: concrete completion conditions.

### Decisions

If a choice materially affects architecture, security, cost, the tech stack or scope, ask me **all such questions together at the start of the stage**, with your recommendation. Don't ask about trivial details: pick a sensible default and mention it.

---

## 4. Stage Report (after each stage)

Keep it concise and factual:

- **What was built**: plain-language summary of the stage.
- **Files changed**: each important file with one line on what it does.
- **How it works**: a short flow of the data/control path (an arrow diagram is fine).
- **Key decisions**: what was chosen and why, in a sentence each.
- **What went wrong**: bugs, failed approaches, surprises, and how each was fixed. Be honest, including things that were changed after seeing results.
- **Tests and checks**: exactly what was run and the results. Never claim a test passed unless it was actually run.
- **Known limitations**: what doesn't work yet or was deliberately left out.
- **Next stage**: the next stage and anything I need to prepare (accounts, tools, keys stored in `.env`).

Then write:

> **STOPPED — waiting for your approval before starting the next stage.**

and stop.

---

## 5. Engineering Rules

- Inspect the existing code before changing it. Make the smallest correct change that completes the stage.
- Don't rewrite working code for style, and don't add speculative abstractions.
- Prefer the simplest architecture that works. Do not add infrastructure (Kafka, Redis, Kubernetes, microservices…) unless a real requirement justifies it.
- Code quality:
  - Prefer clear names, small functions, type hints, explicit schemas, and comments that explain _why_.
  - Use consistent formatting with ESLint (eslint-config-next + typescript-eslint), Prettier (with prettier-plugin-tailwindcss) and `tsc --noEmit` in strict mode.
  - Avoid dead code, magic numbers, catch-all exception handling and silent failures.
- **Never mention stage numbers in code comments, docstrings or tests.**
- Errors: fail explicitly. Never silently discard data. Never log secrets.
- Update `README.md` and `docs/` when behaviour or architecture changes.

### Dependencies

Briefly state why each new dependency is needed. Pin **exact versions that are at least 2 weeks old**. Avoid bloat.

---

## 6. Security Rules (mandatory)

- Never hard-code or commit secrets, keys or credentials, or put them in sample data, tests, logs or frontend code.
- Secrets live in a gitignored `.env` (chmod 600). Never print, commit or ask for their values. I will never paste keys in chat.
- Use least-privilege permissions. No admin access "to make development easier".
- Only test against systems I own or am explicitly authorised to use, plus synthetic data.
- Use synthetic or sanitised data first. Test emails use `@example.com`; fake IDs and keys end in `EXAMPLE`; sample people are first names only (Ana, Ben, Kai); sample places are real public landmarks.
- (If AI is used) The LLM is advisory only: no destructive actions; validate its output against a schema; handle failures with a fallback.

---

## 7. Testing Rules

- Every feature has a positive test and a negative test. Parsers also need malformed-input tests; APIs also need invalid-input tests.
- Before finishing a stage, run the full checks: lint, typecheck, tests and build.
- Never report unexecuted tests as passing. If something fails, say so with the output.

Commands: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` (unit),
`npm run test:db` (pgTAP RLS tests), `npm run test:e2e` (Playwright; needs `npm run db:start`),
`npm run build`.

---

## 8. Git Rules

- **One commit per stage**, made at the end after all checks pass. No intermediate or merge commits.
- Work on a branch named after the stage's work. If checks pass, `git merge --ff-only` into `main` and delete the branch. If they fail, leave the branch unmerged and report why.
- **Commit messages:** short, general, **past tense**, no type prefixes (e.g. "Added user authentication").
- **Push:** push to `origin` after the commit lands on `main`. Never force-push without my explicit approval.
- **Authorship:** commits are authored only by my configured Git identity. **No `Co-Authored-By` trailers, no "Generated with Claude Code", no AI attribution** in commits or PRs. I do not want my repo to show commits made by Claude.
- **Never commit:** `.env`, secrets, credentials, generated databases or large raw data.

---

## 9. Cost Awareness

For cloud or paid APIs: say what it may cost before using it, prefer local or free options, tear resources down when the stage is done, and avoid high-volume API calls during development.

---

## 10. Stages (maximum 7)

Each stage is completed in one go, then STOP.

| #   | Stage                                                     | Outcome                                                                                                                                            |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Foundation: repo, stack, design system, auth, tests, lint | Sign up/in (password + magic link) against local Supabase, profiles with RLS, app shell, landing page, full check suite and CI.                    |
| 2   | Travel DNA + Atlas                                        | Swipe-based taste onboarding, editable preferences, Mapbox world map of visited places, public profile.                                            |
| 3   | Drift + Compass AI layer                                  | Gemini cards grounded with Google Places, swipe deck, natural-language search on a globe, saves; schema validation, fallbacks, caching, quotas.    |
| 4   | Trip Canvas + Compose                                     | Trips, day timeline linked to the map, drag and drop, AI-composed itineraries with real travel times, budget/pace meters, accept/reject proposals. |
| 5   | Huddle                                                    | Invites and roles, live co-editing with presence, Group Drift, voting, Consensus planning.                                                         |
| 6   | Field Notes                                               | Follows, reviews, ratings, photos, feed, Fork-a-trip, AI-drafted trip stories.                                                                     |
| 7   | Polish: README, demo, local setup                         | Accessibility and performance passes, full e2e coverage, demo seed data, docs, one-command local setup. No deployment.                             |

MVP: sign up → build Travel DNA → swipe and save in Drift → Compose a trip → view and edit it on the map. It should be working by Stage 4, so a demoable project exists early.

---

## 11. When I Say "Continue"

Check the repo state, identify the next unfinished stage, confirm its prerequisites, then follow Sections 3 and 4. "Continue" means **one stage**, never several.

---

## 12. Honesty

- Describe the project accurately: a prototype or portfolio-grade, not production-ready or enterprise-scale unless it truly is.
- Never invent metrics (users, accuracy, performance). Only report results that were measured.
