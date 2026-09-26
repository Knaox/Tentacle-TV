import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getBackendBase } from "../../../lib/backendBase";
import { PrimaryCta } from "../misc/shared/PrimaryCta";
import { AuthScreen } from "./AuthScreen";
import {
  AUTH_ERROR, AUTH_INPUT_CLASS, AUTH_INPUT_STYLE, AUTH_LINK, AUTH_LINK_ROW, AUTH_SUBTITLE, AUTH_TITLE,
} from "./authStyles";

/**
 * `RegisterScreen` de l'app (`/register`), plein écran hors coquille : logo 56
 * (marge 16), carte de 400 ; clé d'invitation en chasse fixe (1,5), identifiant,
 * mot de passe, confirmation (filet rouge si elle diffère, message 12) ; CTA à
 * 24, 45 % tant que le formulaire est incomplet. Logique de `pages/Register.tsx`
 * (`?invite=` prérempli, `/api/auth/register`, retour à `/login`).
 */
export function MirrorRegister() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inviteKey, setInviteKey] = useState(searchParams.get("invite") ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = !!inviteKey && !!username && !!password && !!confirmPassword && !mismatch && !loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getBackendBase()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteKey, username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || t("registrationFailed"));
      }
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen logoSize={56} logoGap={16}>
      <h1 style={AUTH_TITLE}>{t("joinTentacle")}</h1>
      <p style={AUTH_SUBTITLE}>{t("invitationOnly")}</p>

      <form onSubmit={submit}>
        <input
          value={inviteKey}
          onChange={(e) => setInviteKey(e.target.value)}
          placeholder={t("inviteKey")}
          aria-label={t("inviteKey")}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className={`${AUTH_INPUT_CLASS} font-mono`}
          style={{ ...AUTH_INPUT_STYLE, letterSpacing: 1.5 }}
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("username")}
          aria-label={t("username")}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          className={AUTH_INPUT_CLASS}
          style={{ ...AUTH_INPUT_STYLE, marginTop: 12 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          aria-label={t("password")}
          autoComplete="new-password"
          className={AUTH_INPUT_CLASS}
          style={{ ...AUTH_INPUT_STYLE, marginTop: 12 }}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t("confirmPassword")}
          aria-label={t("confirmPassword")}
          aria-invalid={mismatch}
          autoComplete="new-password"
          className={AUTH_INPUT_CLASS}
          style={{
            ...AUTH_INPUT_STYLE,
            marginTop: 12,
            ...(mismatch ? { borderColor: "color-mix(in srgb, var(--status-error) 50%, transparent)" } : null),
          }}
        />

        {mismatch && (
          <p role="alert" style={{ ...AUTH_ERROR, fontSize: 12, marginTop: 8 }}>{t("passwordMismatch")}</p>
        )}
        {error && <p role="alert" style={AUTH_ERROR}>{error}</p>}

        <PrimaryCta type="submit" disabled={!canSubmit} loading={loading} style={{ marginTop: 24 }}>
          {t("createAccount")}
        </PrimaryCta>
      </form>

      <button type="button" onClick={() => navigate("/login", { replace: true })} className={AUTH_LINK_ROW} style={{ marginTop: 16, minHeight: 44 }}>
        <span className="text-content-tertiary" style={{ fontSize: 13 }}>
          {t("alreadyHaveAccount")} <span style={AUTH_LINK}>{t("signIn")}</span>
        </span>
      </button>
    </AuthScreen>
  );
}
