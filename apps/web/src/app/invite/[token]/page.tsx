import { redirect } from "next/navigation";
import { errorKey } from "@velo/shared";
import { getT, requireUser } from "@/lib/supabase";

async function accept(token: string) {
  "use server";
  const { supabase } = await requireUser();
  const { data: orgId, error } = await supabase.rpc("accept_invite", { _token: token });
  if (error) {
    const code = /^(invite|license)_\w+$/.test(error.message) ? error.message : "invite_invalid";
    redirect(`/invite/${token}?error=${code}`);
  }
  redirect(`/org/${orgId}`);
}

// The proxy sends signed-out visitors through /login and back here.
export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  const { email } = await requireUser();
  const { t } = await getT();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t("invite_title")}</h1>
      <p className="opacity-60">{email}</p>
      {typeof error === "string" && <p className="error">{t(errorKey(error))}</p>}
      <form action={accept.bind(null, token)}>
        <button className="btn">{t("accept_invite")}</button>
      </form>
    </main>
  );
}
