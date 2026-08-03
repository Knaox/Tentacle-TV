import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";
import { GlassCard } from "@tentacle-tv/ui";
import { backendUrl } from "../main";
import { isDesktopApp } from "../desktop/bridge";
import { TentacleLogo } from "../components/ui/TentacleLogo";
import { setSessionExpired, useSessionExpired } from "../auth/sessionState";

const CTA_PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-cta-primary-bg text-sm font-bold text-cta-primary-fg transition-all hover:-translate-y-0.5 hover:bg-cta-primary-bg-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
const INPUT_BASE =
  "h-11 w-full rounded-lg border border-line-subtle bg-fill-subtle px-3 text-sm text-content-primary outline-none transition placeholder:text-content-quaternary focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/30";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("auth");
  const { login, changeServer } = useAuth();
  const sessionExpired = useSessionExpired();

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

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setForgotSending(true);
    try {
      await fetch(`${backendUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      setForgotSent(true);
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(var(--brand-rgb), 0.18) 0%, rgba(var(--brand-rgb), 0.04) 30%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <TentacleLogo size="lg" variant="glow" />
          <h1 className="mt-5 mb-2 text-3xl font-extrabold tracking-tight text-content-primary">
            {t("tentacle")}
          </h1>
          <p className="text-sm text-content-tertiary">{t("signInSubtitle")}</p>
        </div>

        {sessionExpired && !showForgot && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-line-subtle bg-fill-subtle px-4 py-3 text-sm text-content-secondary"
          >
            {t("sessionExpired")}
          </div>
        )}

        <GlassCard className="p-6">
          {showForgot ? (
            <ForgotPasswordForm
              t={t}
              forgotUsername={forgotUsername}
              setForgotUsername={setForgotUsername}
              forgotSending={forgotSending}
              forgotSent={forgotSent}
              onSubmit={handleForgotSubmit}
              onBack={() => { setShowForgot(false); setForgotSent(false); setForgotUsername(""); }}
            />
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="username" className="mb-1 block text-xs font-medium text-content-tertiary">
                    {t("username")}
                  </label>
                  <input
                    id="username" type="text" value={username} required
                    onChange={(e) => setUsername(e.target.value)}
                    className={INPUT_BASE}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-1 block text-xs font-medium text-content-tertiary">
                    {t("password")}
                  </label>
                  <input
                    id="password" type="password" value={password} required
                    onChange={(e) => setPassword(e.target.value)}
                    className={INPUT_BASE}
                    autoComplete="current-password"
                  />
                </div>

                {login.error && (
                  <p className="text-sm text-[var(--status-error-fg)]" role="alert">
                    {login.error.message?.includes("401")
                      ? t("invalidCredentials")
                      : login.error.message?.includes("502") || login.error.message?.includes("503")
                        ? t("common:offlineTitle")
                        : login.error.message || t("loginFailed")}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={login.isPending}
                  className={CTA_PRIMARY}

                >
                  {login.isPending ? t("signingIn") : t("signIn")}
                </button>
              </form>

              <button
                onClick={() => setShowForgot(true)}
                className="mt-3 w-full text-center text-sm font-medium text-content-quaternary transition-colors hover:text-[var(--brand-light)]"
              >
                {t("forgotPassword")}
              </button>

              <p className="mt-5 text-center text-sm text-content-quaternary">
                {t("haveInviteKey")}{" "}
                <Link to="/register" className="font-semibold text-[var(--brand-light)] hover:underline">
                  {t("createAccount")}
                </Link>
              </p>

              {isDesktopApp() && (
                <button
                  onClick={() => changeServer.mutate(undefined, { onSettled: () => window.location.reload() })}
                  className="mt-5 w-full text-center text-xs font-medium text-content-quaternary transition-colors hover:text-content-tertiary"
                >
                  {t("changeServer")}
                </button>
              )}
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function ForgotPasswordForm({ t, forgotUsername, setForgotUsername, forgotSending, forgotSent, onSubmit, onBack }: {
  t: (key: string) => string;
  forgotUsername: string;
  setForgotUsername: (v: string) => void;
  forgotSending: boolean;
  forgotSent: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  if (forgotSent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-[var(--status-success-fg)]">{t("forgotPasswordSuccess")}</p>
        <button onClick={onBack} className="text-sm font-semibold text-[var(--brand-light)] hover:underline">
          {t("signIn")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-content-primary">{t("forgotPasswordTitle")}</h2>
        <p className="text-sm text-content-tertiary">{t("forgotPasswordDescription")}</p>
      </div>
      <div>
        <label htmlFor="forgot-username" className="mb-1 block text-xs font-medium text-content-tertiary">
          {t("username")}
        </label>
        <input
          id="forgot-username" type="text" value={forgotUsername} required
          onChange={(e) => setForgotUsername(e.target.value)}
          className={INPUT_BASE}
          autoFocus
        />
      </div>
      <button type="submit" disabled={forgotSending} className={CTA_PRIMARY}>
        {forgotSending ? t("common:sending") : t("sendRequest")}
      </button>
      <button type="button" onClick={onBack} className="w-full text-center text-sm font-medium text-content-quaternary transition-colors hover:text-[var(--brand-light)]">
        {t("signIn")}
      </button>
    </form>
  );
}
