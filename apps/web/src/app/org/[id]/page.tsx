import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { errorKey, INVITABLE_ROLES, inviteSchema, nameSchema, type Role } from "@velo/shared";
import { getT, requireUser, SITE_URL } from "@/lib/supabase";

// RLS decides what each action may do; these only validate input and report the outcome.
// Triggers raise codes such as license_limit_teams as the error message.
function fail(orgId: string, message?: string): never {
  const code = message && /^license_\w+$/.test(message) ? message : "generic";
  redirect(`/org/${orgId}?error=${code}`);
}

async function addTeam(orgId: string, formData: FormData) {
  "use server";
  const { supabase } = await requireUser();
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) redirect(`/org/${orgId}?error=invalid_input`);

  const { error } = await supabase.from("teams").insert({
    org_id: orgId,
    name: name.data,
    sport: String(formData.get("sport") ?? "").trim().slice(0, 60),
  });
  if (error) fail(orgId, error.message);
  redirect(`/org/${orgId}`);
}

async function addInvite(orgId: string, formData: FormData) {
  "use server";
  const { supabase } = await requireUser();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/org/${orgId}?error=invalid_input`);

  const { error } = await supabase.from("invites").insert({ org_id: orgId, ...parsed.data });
  if (error) fail(orgId, error.message);
  redirect(`/org/${orgId}`);
}

async function removeInvite(orgId: string, formData: FormData) {
  "use server";
  const { supabase } = await requireUser();
  await supabase.from("invites").delete().eq("id", String(formData.get("id"))).eq("org_id", orgId);
  redirect(`/org/${orgId}`);
}

const STAFF: Role[] = ["owner", "admin", "coach"];

export default async function OrgPage({ params, searchParams }: PageProps<"/org/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, userId } = await requireUser();
  const { t, locale } = await getT();

  const [{ data: org }, { data: teams }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("teams").select("id, name, sport").eq("org_id", id).order("name"),
    supabase.from("memberships").select("user_id, role, profiles(full_name)").eq("org_id", id),
  ]);
  if (!org) notFound();

  const myRole: Role | undefined = members?.find((m) => m.user_id === userId)?.role;
  const isAdmin = myRole === "owner" || myRole === "admin";
  const [{ data: license }, { data: invites }] = isAdmin
    ? await Promise.all([
        supabase.from("licenses").select("*").eq("org_id", id).maybeSingle(),
        supabase
          .from("invites")
          .select("id, email, role, token")
          .eq("org_id", id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString()),
      ])
    : [{ data: null }, { data: null }];

  const count = (roles: Role[]) => members?.filter((m) => roles.includes(m.role)).length ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <Link className="link text-sm" href="/">
          ← {t("your_clubs")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
      </header>
      {typeof error === "string" && <p className="error">{t(errorKey(error))}</p>}

      {license && (
        <section className="card flex flex-col gap-1 text-sm">
          <h2 className="font-medium">
            {t("license")} · {t(`status_${license.status as "trialing"}`)},{" "}
            {t("valid_until", {
              date: new Date(license.current_period_end).toLocaleDateString(locale),
            })}
          </h2>
          <p className="opacity-70">
            {t("license_usage", {
              coaches: count(STAFF),
              maxCoaches: license.max_coaches,
              teams: teams?.length ?? 0,
              maxTeams: license.max_teams,
              athletes: count(["athlete"]),
              maxAthletes: license.max_athletes,
            })}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("teams")}</h2>
        {teams?.length ? (
          <ul className="flex flex-col gap-2">
            {teams.map((team) => (
              <li key={team.id} className="card flex justify-between gap-4">
                <span>{team.name}</span>
                <span className="opacity-60">{team.sport}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="opacity-60">{t("no_teams")}</p>
        )}
        {isAdmin && (
          <form action={addTeam.bind(null, id)} className="flex flex-wrap items-end gap-3">
            <label className="field flex-1">
              {t("team_name")}
              <input className="input" name="name" required maxLength={120} />
            </label>
            <label className="field flex-1">
              {t("sport")}
              <input className="input" name="sport" maxLength={60} />
            </label>
            <button className="btn">{t("add_team")}</button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("members")}</h2>
        <ul className="flex flex-col gap-2">
          {members?.map((m) => (
            <li key={m.user_id} className="card flex justify-between gap-4">
              <span>{(m.profiles as unknown as { full_name: string } | null)?.full_name}</span>
              <span className="opacity-60">{t(`role_${m.role as Role}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("invites")}</h2>
          {invites?.length ? (
            <>
              <p className="hint">{t("invite_link_hint")}</p>
              <ul className="flex flex-col gap-2">
                {invites.map((invite) => (
                  <li key={invite.id} className="card flex flex-col gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span>{invite.email}</span>
                      <span className="opacity-60">{t(`role_${invite.role as Role}`)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        className="input flex-1 text-xs"
                        readOnly
                        aria-label={`${t("invite")} ${invite.email}`}
                        value={`${SITE_URL}/invite/${invite.token}`}
                      />
                      <form action={removeInvite.bind(null, id)}>
                        <input type="hidden" name="id" value={invite.id} />
                        <button className="link cursor-pointer" aria-label={`✕ ${invite.email}`}>
                          ✕
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <form action={addInvite.bind(null, id)} className="flex flex-wrap items-end gap-3">
            <label className="field flex-1">
              {t("email")}
              <input className="input" name="email" type="email" required />
            </label>
            <label className="field">
              {t("role")}
              <select className="input" name="role" defaultValue="athlete">
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`role_${role}`)}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn">{t("invite")}</button>
          </form>
        </section>
      )}
    </main>
  );
}
