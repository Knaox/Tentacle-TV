import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getBackendBase } from "../../../lib/backendBase";
import { KeyRound, Lock, User } from "lucide-react";
import { AuthField, PasswordField } from "../../../components/auth/AuthField";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthAlert } from "../../../components/auth/AuthAlert";
import { AuthScreen } from "./AuthScreen";
import { AuthLinkRow } from "./AuthLinkRow";

/**
 * `RegisterScreen` de l'app (`/register`), plein écran hors coquille : logo 56,
 * retour en haut ; clé d'invitation en chasse fixe avec son aide, identifiant,
 * mot de passe, confirmation (écart signalé au champ une fois la saisie finie).
 * Logique de `pages/Register.tsx` (`?invite=` prérempli, `/api/auth/register`,
 * retour à `/login`).
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
  const [confirmTouched, setConfirmTouched] = useState(false);

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

  const showMismatch = mismatch && (confirmTouched || confirmPassword.length >= password.length);
  const backToLogin = () => navigate("/login", { replace: true });

  return (
    <AuthScreen
      title={t("joinTentacle")}
      subtitle={t("invitationOnly")}
      onBack={backToLogin}
      logoSize={56}
      footer={<AuthLinkRow prefix={t("alreadyHaveAccount")} label={t("signIn")} onClick={backToLogin} />}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField
          id="m-reg-invite"
          label={t("inviteKey")}
          icon={KeyRound}
          hint={t("inviteKeyHint")}
          value={inviteKey}
          onChange={(e) => setInviteKey(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          className="font-mono tracking-wider"
        />
        <AuthField
          id="m-reg-username"
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
        <PasswordField
          id="m-reg-password"
          label={t("password")}
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          enterKeyHint="next"
        />
        <PasswordField
          id="m-reg-confirm"
          label={t("confirmPassword")}
          icon={Lock}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          error={showMismatch ? t("passwordMismatch") : undefined}
          autoComplete="new-password"
          enterKeyHint="go"
        />

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <AuthButton type="submit" loading={loading} loadingLabel={t("creatingAccount")} disabled={!canSubmit && !loading}>
          {t("createAccount")}
        </AuthButton>
      </form>
    </AuthScreen>
  );
}
