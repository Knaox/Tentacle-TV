import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Server, User, Lock } from "lucide-react";
import { useAuth } from "@tentacle-tv/api-client";
import { isDesktopApp } from "../desktop/bridge";
import { setSessionExpired, useSessionExpired } from "../auth/sessionState";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthField, PasswordField } from "../components/auth/AuthField";
import { AuthButton, AuthTextButton } from "../components/auth/AuthButton";
import { AuthAlert } from "../components/auth/AuthAlert";
import { ForgotPasswordPanel } from "../components/auth/ForgotPasswordPanel";
import { loginErrorMessage } from "../components/auth/loginError";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("auth");
  const { login, changeServer } = useAuth();
  const sessionExpired = useSessionExpired();
  const desktop = isDesktopApp();

  // Destination après connexion : ?redirect=/share/... (chemin interne only),
  // sinon accueil. Garde-fou : on n'autorise qu'un chemin relatif.
  const redirectParam = searchParams.get("redirect");
  const redirectTo = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
    ? redirectParam
    : "/";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password }, {
      onSuccess: () => {
        // Le drapeau est consommé ICI, et pas au démontage de l'écran : sous
        // StrictMode, le nettoyage d'effet du montage simulé l'effaçait avant
        // même le premier rendu visible, et l'utilisateur atterrissait sur un
        // écran de connexion sans explication. La reconnexion réussie est de
        // toute façon le seul moment où le message n'a plus lieu d'être.
        setSessionExpired(false);
        navigate(redirectTo, { replace: true });
      },
    });
  };

  const error = login.error ? loginErrorMessage(login.error.message) : null;
  const errorText = error ? ("key" in error ? t(error.key) : error.text) : null;
  const badCredentials = !!error && "key" in error && error.key === "invalidCredentials";

  // Identifiants refusés : le curseur revient au mot de passe, sélectionné —
  // c'est presque toujours lui qu'il faut retaper.
  useEffect(() => {
    if (badCredentials) passwordRef.current?.select();
  }, [badCredentials, login.error]);

  if (showForgot) {
    return (
      <AuthLayout title={t("forgotPasswordTitle")} subtitle={t("forgotPasswordDescription")}>
        <ForgotPasswordPanel onBack={() => setShowForgot(false)} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      header={sessionExpired ? <AuthAlert tone="info" className="mb-5">{t("sessionExpired")}</AuthAlert> : null}
      footer={
        <>
          <p className="text-sm text-content-tertiary">
            {t("haveInviteKey")}{" "}
            <Link
              to="/register"
              className="rounded font-semibold text-[var(--brand-light)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              {t("createAccount")}
            </Link>
          </p>
          {desktop && <ServerSwitch onChange={() => changeServer.mutate(undefined, { onSettled: () => window.location.reload() })} pending={changeServer.isPending} />}
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="username"
          label={t("username")}
          icon={User}
          value={username}
          required
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
        <div>
          <PasswordField
            id="password"
            ref={passwordRef}
            label={t("password")}
            icon={Lock}
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={badCredentials || undefined}
          />
          <div className="mt-1 flex justify-end">
            <AuthTextButton onClick={() => setShowForgot(true)} className="-mr-2 text-[13px]">
              {t("forgotPassword")}
            </AuthTextButton>
          </div>
        </div>

        {errorText && <AuthAlert tone="error">{errorText}</AuthAlert>}

        <AuthButton type="submit" loading={login.isPending} loadingLabel={t("signingIn")} disabled={!username || !password}>
          {t("signIn")}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}

/**
 * Le serveur visé, dans la coquille de bureau seulement : sur le web, le
 * serveur EST le site. `tentacle_server_url` est lu, jamais écrit ici.
 */
function ServerSwitch({ onChange, pending }: { onChange: () => void; pending: boolean }) {
  const { t } = useTranslation("auth");
  const host = serverHost(localStorage.getItem("tentacle_server_url"));
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 text-[13px] text-content-tertiary">
      {host && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Server aria-hidden size={14} />
          <span className="sr-only">{t("serverLabel")} :</span>
          <span className="max-w-[16rem] truncate font-medium text-content-secondary" title={host}>{host}</span>
        </span>
      )}
      <AuthTextButton onClick={onChange} disabled={pending} className="text-[13px]">
        {t("changeServer")}
      </AuthTextButton>
    </div>
  );
}

function serverHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
