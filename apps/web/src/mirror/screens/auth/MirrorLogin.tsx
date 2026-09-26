import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";
import { setSessionExpired, useSessionExpired } from "../../../auth/sessionState";
import { isDesktopApp } from "../../../desktop/bridge";
import { PrimaryCta } from "../misc/shared/PrimaryCta";
import { AuthScreen } from "./AuthScreen";
import {
  AUTH_ERROR, AUTH_INPUT_CLASS, AUTH_INPUT_STYLE, AUTH_LINK, AUTH_LINK_ROW, AUTH_SUBTITLE, AUTH_TITLE,
} from "./authStyles";
import { ForgotPasswordContent } from "./ForgotPasswordContent";
import { loginErrorMessage } from "./loginError";

/**
 * `LoginScreen` de l'app (`/login`), plein écran hors coquille : logo 64 (marge
 * 20), carte de 400 ; « Tentacle TV », sous-titre, identifiant et mot de passe
 * (placeholders, écart 12), erreur, CTA à 24 (55 % tant qu'il manque un champ),
 * mot de passe oublié, création de compte. La logique est celle de
 * `pages/Login.tsx` : `useAuth().login`, `?redirect=`, session expirée, et le
 * mot de passe oublié — un écran à part dans l'app, une vue de la carte ici.
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

  if (forgot) {
    return (
      <AuthScreen logoSize={0} logoGap={0}>
        <ForgotPasswordContent onBack={() => setForgot(false)} />
      </AuthScreen>
    );
  }

  const error = login.error ? loginErrorMessage(login.error.message) : null;

  return (
    <AuthScreen logoSize={64} logoGap={20}>
      <h1 style={AUTH_TITLE}>{t("tentacle")}</h1>
      <p style={AUTH_SUBTITLE}>{t("signInSubtitle")}</p>

      {sessionExpired && (
        <p role="status" className="rounded-lg border border-line-subtle bg-fill-subtle text-content-secondary" style={{ fontSize: 13, padding: "10px 14px", marginBottom: 16 }}>
          {t("sessionExpired")}
        </p>
      )}

      <form onSubmit={submit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("username")}
          aria-label={t("username")}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          className={AUTH_INPUT_CLASS}
          style={AUTH_INPUT_STYLE}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          aria-label={t("password")}
          autoComplete="current-password"
          className={AUTH_INPUT_CLASS}
          style={{ ...AUTH_INPUT_STYLE, marginTop: 12 }}
        />

        {error && (
          <p role="alert" style={AUTH_ERROR}>{"key" in error ? t(error.key) : error.text}</p>
        )}

        <PrimaryCta type="submit" disabled={incomplete || login.isPending} loading={login.isPending} disabledOpacity={0.55} style={{ marginTop: 24 }}>
          {t("signIn")}
        </PrimaryCta>
      </form>

      <button type="button" onClick={() => setForgot(true)} className={AUTH_LINK_ROW} style={{ marginTop: 16, minHeight: 44 }}>
        <span style={AUTH_LINK}>{t("forgotPassword")}</span>
      </button>

      <button type="button" onClick={() => navigate("/register")} className={AUTH_LINK_ROW} style={{ marginTop: 4, minHeight: 44 }}>
        <span className="text-content-tertiary" style={{ fontSize: 13 }}>
          {t("noAccount")} <span style={AUTH_LINK}>{t("createAccount")}</span>
        </span>
      </button>

      {/* Changer de serveur n'a de sens que dans la coquille de bureau : sur le
          web, le serveur EST le site. L'app le propose toujours. */}
      {isDesktopApp() && (
        <div className="border-t border-line-subtle" style={{ marginTop: 12, paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => changeServer.mutate(undefined, { onSettled: () => window.location.reload() })}
            className={AUTH_LINK_ROW}
            style={{ minHeight: 44 }}
          >
            <span className="font-medium text-content-tertiary" style={{ fontSize: 12, letterSpacing: 0.3 }}>{t("changeServer")}</span>
          </button>
        </div>
      )}
    </AuthScreen>
  );
}
