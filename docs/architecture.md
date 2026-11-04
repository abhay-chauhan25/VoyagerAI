# Architecture

## Layout

```text
src/
  app/
    page.tsx                 landing page (public)
    (auth)/                  sign-in, sign-up, check-email (public, guests only)
    (app)/                   drift, trips, atlas, notes, account (signed-in only)
    auth/callback/route.ts   exchanges email-link codes for a session
    globals.css              design tokens (light + dark) and base styles
  components/
    ui/        buttons, fields, form messages
    shell/     app shell, navigation, icons, avatar
    landing/   landing sections and product fragments
    auth/ account/ app/ brand/ theme/
  lib/
    env.ts                   validated public configuration
    supabase/                browser, server and proxy clients; generated DB types
    auth/                    zod schemas, server actions, route rules
    brief/                   rule-based trip-wish parser
    user/                    current user loader, initials and avatar hues
  proxy.ts                   runs on every request: session refresh + route guard
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

- Email + password: `signUp` sends a confirmation email (confirmations are required). The link
  goes to Supabase, then to `/auth/callback?code=…`, which exchanges the one-time code (PKCE) for a
  session cookie and continues to a same-site path.
- Magic link: `signInWithOtp` with `shouldCreateUser: false`, so links only sign in existing
  accounts. The response is identical whether or not the account exists (no email enumeration).
- Redirect targets pass through `safeNextPath()`, which accepts only same-site relative paths.
- Password rules (8+ characters, a letter and a number, at most 72) are enforced both in
  `supabase/config.toml` and in the zod schema, so the form explains them before submitting.

## Database security

- `profiles`: RLS on. Owners can read and update their own row; only `display_name` and `home_city`
  are updatable (column-level grants). No insert or delete grants: rows are created by the
  `handle_new_user` trigger (`SECURITY DEFINER`, pinned `search_path`) and removed by cascade.
- `anon` has no table privileges.
- `supabase/tests/profiles_rls.test.sql` checks each of these rules, including the negative cases.

## Design system

Tokens in `src/app/globals.css` define roles, not colours: `bg`, `surface`, `ground`, `panel`,
`ink`, `muted`, `accent`, `primary`, status colours and motion curves. Dark mode redefines the same
roles, either from the system preference or a saved choice (`data-theme` on `<html>`, applied
before first paint by an inline script).

## Configuration

Only public values are used so far, validated at runtime by `src/lib/env.ts`:

| Variable                               | Notes                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | local: `http://127.0.0.1:54321`                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser-safe by design; every table is protected by RLS |
| `NEXT_PUBLIC_SITE_URL`                 | base for auth redirect links                            |

The Supabase secret / service-role key is not used by the app and must never be added to `.env`
for the app's use.
