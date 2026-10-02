import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { pickLocale, translator } from "@velo/shared";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies; the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}

// Every page and Server Action behind login calls this; the proxy redirect is only a convenience.
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return { supabase, userId: data.claims.sub, email: data.claims.email as string };
}

export async function getT() {
  const locale = pickLocale((await headers()).get("accept-language"));
  return { locale, t: translator(locale) };
}

// Only same-site paths, so `next` cannot be used as an open redirect.
export function safeNext(value: unknown, fallback = "/") {
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : fallback;
}
