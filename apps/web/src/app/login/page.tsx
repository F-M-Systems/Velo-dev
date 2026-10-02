import Link from "next/link";
import { errorKey, PASSWORD_MIN, type MessageKey } from "@velo/shared";
import { getT, safeNext } from "@/lib/supabase";
import { forgotPassword, login, signup } from "./actions";

const NOTICES: Record<string, MessageKey> = {
  check_email: "notice_check_email",
  reset_sent: "notice_reset_sent",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { mode, next, error, notice } = await searchParams;
  const { t } = await getT();
  const nextPath = safeNext(next);
  const withNext = (m?: string) =>
    `/login?${new URLSearchParams({ ...(m && { mode: m }), next: nextPath })}`;
  const noticeKey = typeof notice === "string" ? NOTICES[notice] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("app_name")}</h1>
      {noticeKey && <p className="notice">{t(noticeKey)}</p>}
      {typeof error === "string" && <p className="error">{t(errorKey(error))}</p>}

      <form className="flex flex-col gap-3">
        <input type="hidden" name="next" value={nextPath} />
        {mode === "signup" && (
          <label className="field">
            {t("full_name")}
            <input className="input" name="full_name" autoComplete="name" required maxLength={120} />
          </label>
        )}
        <label className="field">
          {t("email")}
          <input className="input" name="email" type="email" autoComplete="email" required />
        </label>
        {mode !== "forgot" && (
          <label className="field">
            {t("password")}
            <input
              className="input"
              name="password"
              type="password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? PASSWORD_MIN : undefined}
            />
            {mode === "signup" && <span className="hint">{t("password_hint")}</span>}
          </label>
        )}
        {mode === "signup" ? (
          <button className="btn" formAction={signup}>
            {t("sign_up")}
          </button>
        ) : mode === "forgot" ? (
          <button className="btn" formAction={forgotPassword}>
            {t("send_reset_link")}
          </button>
        ) : (
          <button className="btn" formAction={login}>
            {t("sign_in")}
          </button>
        )}
      </form>

      <nav className="flex flex-col gap-2 text-sm">
        {mode ? (
          <Link className="link" href={withNext()}>
            {t("back_to_sign_in")}
          </Link>
        ) : (
          <>
            <Link className="link" href={withNext("signup")}>
              {t("no_account")}
            </Link>
            <Link className="link" href={withNext("forgot")}>
              {t("forgot_password")}
            </Link>
          </>
        )}
      </nav>
    </main>
  );
}
