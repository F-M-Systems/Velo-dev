import { redirect } from "next/navigation";
import { errorKey, PASSWORD_MIN, signupSchema } from "@velo/shared";
import { getT, requireUser } from "@/lib/supabase";

async function updatePassword(formData: FormData) {
  "use server";
  const { supabase } = await requireUser();
  const parsed = signupSchema.shape.password.safeParse(formData.get("password"));
  if (!parsed.success) redirect("/account/password?error=weak_password");

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    redirect(`/account/password?error=${error.code === "weak_password" ? error.code : "generic"}`);
  }
  // Sign out every other device: whoever knew the old password loses access.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/?notice=password_updated");
}

export default async function PasswordPage({ searchParams }: PageProps<"/account/password">) {
  await requireUser();
  const { error } = await searchParams;
  const { t } = await getT();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t("new_password")}</h1>
      {typeof error === "string" && <p className="error">{t(errorKey(error))}</p>}
      <form action={updatePassword} className="flex flex-col gap-3">
        <label className="field">
          {t("new_password")}
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
          />
          <span className="hint">{t("password_hint")}</span>
        </label>
        <button className="btn">{t("save")}</button>
      </form>
    </main>
  );
}
