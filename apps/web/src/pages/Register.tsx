import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, Lock, User } from "lucide-react";
import { backendUrl } from "../main";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthField, PasswordField } from "../components/auth/AuthField";
import { AuthButton } from "../components/auth/AuthButton";
import { AuthAlert } from "../components/auth/AuthAlert";

const BACKEND_URL = backendUrl;

export function Register() {
  const [searchParams] = useSearchParams();
  const [inviteKey, setInviteKey] = useState(searchParams.get("invite") ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteKey, username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("registrationFailed"));
      }
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMismatch = !!confirmPassword && password !== confirmPassword;
  // L'écart ne s'affiche qu'une fois la confirmation quittée, ou dès qu'elle
  // est aussi longue que le mot de passe : pas de rouge à chaque frappe.
  const showMismatch = passwordsMismatch && (confirmTouched || confirmPassword.length >= password.length);

  return (
    <AuthLayout
      title={t("joinTentacle")}
      subtitle={t("invitationOnly")}
      footer={
        <p className="text-sm text-content-tertiary">
          {t("alreadyHaveAccount")}{" "}
          <Link
            to="/login"
            className="rounded font-semibold text-[var(--brand-light)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            {t("signIn")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="reg-invite"
          label={t("inviteKey")}
          icon={KeyRound}
          hint={t("inviteKeyHint")}
          value={inviteKey}
          required
          onChange={(e) => setInviteKey(e.target.value)}
          className="font-mono tracking-wide"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={!inviteKey}
        />
        <AuthField
          id="reg-username"
          label={t("username")}
          icon={User}
          value={username}
          required
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={!!inviteKey}
        />
        <PasswordField
          id="reg-password"
          label={t("password")}
          icon={Lock}
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordField
          id="reg-confirm"
          label={t("confirmPassword")}
          icon={Lock}
          value={confirmPassword}
          required
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          autoComplete="new-password"
          error={showMismatch ? t("passwordMismatch") : undefined}
        />

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <AuthButton
          type="submit"
          loading={isLoading}
          loadingLabel={t("creatingAccount")}
          disabled={!inviteKey || !username || !password || !confirmPassword || passwordsMismatch}
        >
          {t("createAccount")}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}
