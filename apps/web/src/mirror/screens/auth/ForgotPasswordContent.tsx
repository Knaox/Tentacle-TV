import { useState } from "react";
import { useTranslation } from "react-i18next";
import { User } from "lucide-react";
import { getBackendBase } from "../../../lib/backendBase";
import { AuthField } from "../../../components/auth/AuthField";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthAlert } from "../../../components/auth/AuthAlert";
import { AuthScreen } from "./AuthScreen";
import { AuthLinkRow } from "./AuthLinkRow";

/**
 * `ForgotPasswordScreen` de l'app : logo 56, retour en haut, identifiant, CTA
 * « Envoyer la demande » ; succès = son propre écran (« Demande envoyée »).
 * Même requête que la page du bureau (`/api/auth/password-reset-request`) ;
 * l'échec réseau est annoncé, comme dans l'app.
 */
export function ForgotPasswordContent({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation("auth");
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const canSubmit = !!username.trim() && !sending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setFailed(false);
    try {
      await fetch(`${getBackendBase()}/api/auth/password-reset-request`, {
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
      <AuthScreen title={t("forgotPasswordSentTitle")} onBack={onBack} logoSize={56}>
        <AuthAlert tone="success">{t("forgotPasswordSuccess")}</AuthAlert>
        <AuthButton onClick={onBack} className="mt-5" autoFocus>{t("backToSignIn")}</AuthButton>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={t("forgotPasswordTitle")}
      subtitle={t("forgotPasswordDescription")}
      onBack={onBack}
      logoSize={56}
      footer={<AuthLinkRow label={t("backToSignIn")} onClick={onBack} />}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField
          id="m-forgot-username"
          label={t("username")}
          icon={User}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          enterKeyHint="send"
          autoFocus
        />
        {failed && <AuthAlert tone="error">{t("requestFailed")}</AuthAlert>}
        <AuthButton type="submit" loading={sending} loadingLabel={t("common:sending")} disabled={!username.trim()}>
          {t("sendRequest")}
        </AuthButton>
      </form>
    </AuthScreen>
  );
}
