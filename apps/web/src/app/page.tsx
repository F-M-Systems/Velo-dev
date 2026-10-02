import Link from "next/link";
import { redirect } from "next/navigation";
import { errorKey, nameSchema } from "@velo/shared";
import { getT, requireUser } from "@/lib/supabase";
import { logout } from "./login/actions";

async function createClub(formData: FormData) {
  "use server";
  const { supabase } = await requireUser();
  const { locale } = await getT();
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) redirect("/?error=invalid_input");

  const { data: orgId, error } = await supabase.rpc("create_organization", {
    _name: name.data,
    _locale: locale,
  });
  if (error) {
    console.error("create_organization failed", error);
    redirect("/?error=generic");
  }
  redirect(`/org/${orgId}`);
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { supabase, email } = await requireUser();
  const { error, notice } = await searchParams;
  const { t } = await getT();
  const { data: clubs } = await supabase.from("organizations").select("id, name").order("name");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("app_name")}</h1>
        <form action={logout} className="flex items-center gap-3 text-sm">
          <span className="opacity-60">{email}</span>
          <button className="link cursor-pointer">{t("sign_out")}</button>
        </form>
      </header>
      {notice === "password_updated" && <p className="notice">{t("notice_password_updated")}</p>}
      {typeof error === "string" && <p className="error">{t(errorKey(error))}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("your_clubs")}</h2>
        {clubs?.length ? (
          <ul className="flex flex-col gap-2">
            {clubs.map((club) => (
              <li key={club.id}>
                <Link className="card block hover:border-foreground/40" href={`/org/${club.id}`}>
                  {club.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="opacity-60">{t("no_clubs")}</p>
        )}
      </section>

      <form action={createClub} className="card flex flex-col gap-3">
        <label className="field">
          {t("club_name")}
          <input className="input" name="name" required maxLength={120} />
        </label>
        <button className="btn self-start">{t("create_club")}</button>
      </form>
    </main>
  );
}
