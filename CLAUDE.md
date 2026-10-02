# Velo

Sports-management SaaS for clubs, coaches and athletes, built to compete with XPS Network.
Multi-sport and international; UI text is English and Portuguese. Setup, run and deploy steps are
in `README.md`.

## Layout

- `apps/web`: Next.js (App Router). Read `apps/web/AGENTS.md` before touching it: this Next.js
  version differs from older ones (`src/proxy.ts` replaces middleware, `params` and
  `searchParams` are Promises).
- `apps/mobile`: Expo (iOS and Android only; the Expo web target was removed). Read
  `apps/mobile/AGENTS.md`, and add packages with `npx expo install`.
- `packages/shared`: zod schemas and the `en`/`pt` messages, imported by both apps as
  `@velo/shared`.
- `supabase`: migrations, pgTAP tests, auth config and email templates.

npm workspaces; there is no separate backend. Server logic lives in Postgres (RLS, triggers,
`security definer` functions) and, later, Supabase Edge Functions.

## Rules

- Authorization is enforced by RLS, not by the apps. Every new table needs RLS enabled, explicit
  `grant`s to `authenticated` (never `anon`), policies built on `public.is_member(org_id, roles)`,
  and a case in `supabase/tests`.
- License limits and license expiry are enforced by the `enforce_license` trigger and
  `public.license_active`. Only the service role writes to `licenses`.
- Database errors meant for users are raised as codes (`license_limit_teams`, `invite_invalid`)
  and translated through `errorKey` in `packages/shared/src/i18n.ts`. Add every new user-facing
  string to both `en` and `pt` there.
- Web pages and Server Actions behind login call `requireUser()` from `apps/web/src/lib/supabase.ts`.
  Redirect targets taken from the request go through `safeNext`.
- Secrets live in git-ignored files (`apps/*/.env.local`, `supabase/.env`). The `.env.example`
  files are committed, so they hold variable names only.
- The Supabase client is untyped until types are generated (`npm run db:types` needs a local
  database, which needs Docker).

## Checks

Run before finishing a change:

```
npm run typecheck
npm run lint
```

`npx supabase test db` needs Docker, so it normally runs only in CI.

## External services

- Supabase project `hbvfhhbyniklkcisyxbr` ("Velo Sports", eu-west-1). Apply schema changes with
  `npx supabase db push` and auth config with `npx supabase config push`. Answer no to the storage
  prompt of `config push`: the remote storage settings are intentionally left alone.
- Resend sends auth emails over SMTP. The sender is still `onboarding@resend.dev`, which only
  delivers to the Resend account owner until a domain is verified.
- Vercel project `velo` (team `f-m-systems`, Hobby plan) hosts the web app. Production is not
  live: the first deploy was taken off the public address on purpose. Ask before running
  `vercel deploy --prod`.
