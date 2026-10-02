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
