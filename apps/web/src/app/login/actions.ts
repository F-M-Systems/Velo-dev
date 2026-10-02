"use server";

import { redirect } from "next/navigation";
import { credentialsSchema, emailSchema, signupSchema } from "@velo/shared";
import { createClient, safeNext, SITE_URL } from "@/lib/supabase";

const fields = (formData: FormData) => Object.fromEntries(formData);

export async function login(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const back = `/login?next=${encodeURIComponent(next)}`;
  const parsed = credentialsSchema.safeParse(fields(formData));
  if (!parsed.success) redirect(`${back}&error=invalid_input`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const code = error.code === "email_not_confirmed" ? error.code : "invalid_credentials";
    redirect(`${back}&error=${code}`);
  }
  redirect(next);
}

export async function signup(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const back = `/login?mode=signup&next=${encodeURIComponent(next)}`;
  const parsed = signupSchema.safeParse(fields(formData));
  if (!parsed.success) redirect(`${back}&error=invalid_input`);

  const { email, password, full_name } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) redirect(`${back}&error=${error.code === "weak_password" ? error.code : "generic"}`);
  redirect(`/login?next=${encodeURIComponent(next)}&notice=check_email`);
}

export async function forgotPassword(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?mode=forgot&error=invalid_input");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/account/password`,
  });
  // Same answer whether or not the account exists, so emails cannot be enumerated.
  redirect("/login?notice=reset_sent");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
