import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock, User } from "lucide-react";
import { useAuth } from "@tentacle-tv/api-client";
import { setSessionExpired, useSessionExpired } from "../../../auth/sessionState";
import { isDesktopApp } from "../../../desktop/bridge";
import { AuthField, PasswordField } from "../../../components/auth/AuthField";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthAlert } from "../../../components/auth/AuthAlert";
import { loginErrorMessage } from "../../../components/auth/loginError";
import { AuthScreen } from "./AuthScreen";
import { AuthLinkRow } from "./AuthLinkRow";
import { ForgotPasswordContent } from "./ForgotPasswordContent";

/**
 * `LoginScreen` de l'app (`/login`), plein écran hors coquille : cadre
 * `AuthScreen`, identifiant et mot de passe à libellés visibles, « Mot de passe
 * oublié ? » sous le champ, erreur annoncée, CTA ; création de compte sous la
 * carte. La logique est celle de `pages/Login.tsx` : `useAuth().login`,
 * `?redirect=`, session expirée — le mot de passe oublié est une vue ici.
 */
export function MirrorLogin() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, changeServer } = useAuth();
  const sessionExpired = useSessionExpired();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Seul un chemin interne est accepté comme destination.
  const redirectParam = searchParams.get("redirect");
  const redirectTo = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : "/";

  const incomplete = !username || !password;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (incomplete || login.isPending) return;
    login.mutate({ username, password }, {
      onSuccess: () => {
        // Consommé ici, pas au démontage (cf. pages/Login.tsx et StrictMode).
        setSessionExpired(false);
        navigate(redirectTo, { replace: true });
      },
    });
  };

  const error = login.error ? loginErrorMessage(login.error.message) : null;
  const badCredentials = !!error && "key" in error && error.key === "invalidCredentials";
  useEffect(() => {
    if (badCredentials) passwordRef.current?.select();
  }, [badCredentials, login.error]);

  if (forgot) {
    return <ForgotPasswordContent onBack={() => setForgot(false)} />;
  }

  return (
    <AuthScreen
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      showLanguage
      footer={
        <>
          <AuthLinkRow prefix={t("noAccount")} label={t("createAccount")} onClick={() => navigate("/register")} />
          {/* Changer de serveur n'a de sens que dans la coquille de bureau : sur
              le web, le serveur EST le site. L'app le propose toujours. */}
          {isDesktopApp() && (
            <AuthLinkRow label={t("changeServer")} onClick={() => changeServer.mutate(undefined, { onSettled: () => window.location.reload() })} />
          )}
        </>
      }
    >
      {sessionExpired && <AuthAlert tone="info" className="mb-4">{t("sessionExpired")}</AuthAlert>}

      <form onSubmit={submit} className="space-y-4">
        <AuthField
          id="m-username"
          label={t("username")}
          icon={User}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          enterKeyHint="next"
        />
        <div>
          <PasswordField
            id="m-password"
            ref={passwordRef}
            label={t("password")}
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
            aria-invalid={badCredentials || undefined}
          />
          <div className="-mr-2 mt-1 flex justify-end">
            <AuthLinkRow label={t("forgotPassword")} onClick={() => setForgot(true)} />
          </div>
        </div>

        {error && <AuthAlert tone="error">{"key" in error ? t(error.key) : error.text}</AuthAlert>}

        <AuthButton type="submit" loading={login.isPending} loadingLabel={t("signingIn")} disabled={incomplete}>
          {t("signIn")}
        </AuthButton>
      </form>
    </AuthScreen>
  );
}
