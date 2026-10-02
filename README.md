# Velo

Sports management for clubs, coaches and athletes. Web (Next.js) + mobile (Expo) on Supabase.

```
apps/web          Next.js app
apps/mobile       Expo app (iOS/Android)
packages/shared   validation schemas and translations (en/pt) used by both apps
supabase          migrations (schema + RLS), tests, auth config
```

## Setup

1. `npm install`
2. Create a Supabase project, then push the schema and auth config:
   ```
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   npx supabase config push
   ```
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/mobile/.env.example` to
   `apps/mobile/.env.local`, and fill in the project URL and publishable key.
4. Auth emails go through Resend, using the templates in `supabase/templates`. Copy
   `supabase/.env.example` to `supabase/.env`, paste a Resend API key, and run
   `npx supabase config push` again. Until a domain is verified in Resend and `admin_email` in
   `supabase/config.toml` uses it, emails only reach the Resend account owner.

## Run

```
npm run web       # http://localhost:3000
npm run mobile    # Expo dev server
```

## Check

```
npm run typecheck
npm run lint
npx supabase test db   # needs Docker; also runs in CI
```

After changing the schema, add a file to `supabase/migrations` and a case to `supabase/tests`.

## Deploy

The web app deploys to the Vercel project `velo` (team `f-m-systems`), whose root directory is
`apps/web`. Run these from the repository root after `vercel login` and `vercel link`:

```
vercel deploy          # preview, behind Vercel login
vercel deploy --prod   # public, at https://velo-pearl-xi.vercel.app
```

The project needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
`NEXT_PUBLIC_SITE_URL` (`vercel env ls`). Before the first production deploy, set `site_url` and
`additional_redirect_urls` in `supabase/config.toml` to the public address and run
`npx supabase config push`, otherwise links in auth emails keep pointing at localhost.

The mobile app is not deployed yet; it will ship through Expo EAS.

## Status

Done: sign up, sign in, password recovery, clubs, teams, members, invites, and license limits
(staff, teams, athletes) enforced in the database.

Not built yet: MFA screens, Google/Apple sign-in, Stripe billing, notifications (push, email,
WhatsApp), calendar and attendance, training plans, chat.
