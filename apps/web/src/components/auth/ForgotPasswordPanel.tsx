import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, User } from "lucide-react";
import { backendUrl } from "../../main";
import { AuthAlert } from "./AuthAlert";
import { AuthButton, AuthTextButton } from "./AuthButton";
import { AuthField } from "./AuthField";

/**
 * Le mot de passe oublié, en vue de la carte de connexion. La requête est
 * celle d'origine (`/api/auth/password-reset-request`, champ `username`) ;
 * seul l'échec RÉSEAU est désormais montré — il laissait le bouton revenir
 * sans un mot.
 */
export function ForgotPasswordPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation("auth");
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSending(true);
    setFailed(false);
    try {
      await fetch(`${backendUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <AuthAlert tone="success">
          <p className="font-semibold">{t("forgotPasswordSentTitle")}</p>
          <p className="mt-0.5 opacity-90">{t("forgotPasswordSuccess")}</p>
        </AuthAlert>
        <AuthButton variant="secondary" onClick={onBack} autoFocus>
          {t("backToSignIn")}
        </AuthButton>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <AuthField
        id="forgot-username"
        label={t("username")}
        icon={User}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        autoFocus
      />
      {failed && <AuthAlert tone="error">{t("requestFailed")}</AuthAlert>}
      <AuthButton type="submit" loading={sending} loadingLabel={t("common:sending")} disabled={!username.trim()}>
        {t("sendRequest")}
      </AuthButton>
      <div className="flex justify-center">
        <AuthTextButton onClick={onBack}>
          <ArrowLeft aria-hidden size={16} />
          {t("backToSignIn")}
        </AuthTextButton>
      </div>
    </form>
  );
}
