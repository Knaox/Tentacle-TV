import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, KeyRound } from "lucide-react";
import { getBackendBase } from "../../../lib/backendBase";
import { PrimaryCta } from "../misc/shared/PrimaryCta";
import { AUTH_INPUT_CLASS, AUTH_INPUT_STYLE, AUTH_LINK, AUTH_LINK_ROW, AUTH_SUBTITLE, AUTH_TITLE } from "./authStyles";

/**
 * `ForgotPasswordScreen` de l'app, contenu de la carte : médaillon clé 56
 * (`brand.soft`, filet `brand.glow`), titre 24, description 13/20 ; champ
 * identifiant, CTA « Envoyer » à 22 ; succès = pastille 64 verte, texte 14/20.
 * Même requête que la page du bureau (`/api/auth/password-reset-request`).
 */
export function ForgotPasswordContent({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation("auth");
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const canSubmit = !!username.trim() && !sending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    try {
      await fetch(`${getBackendBase()}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      setSent(true);
    } catch {
      /* comme l'app : rien à dire, on peut renvoyer */
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex justify-center" style={{ marginBottom: 8 }}>
        <span
          className="flex items-center justify-center rounded-full border"
          style={{ width: 56, height: 56, marginBottom: 12, background: "var(--brand-soft)", borderColor: "var(--brand-glow)", color: "var(--brand-light)" }}
        >
          <KeyRound size={26} />
        </span>
      </div>
      <h1 style={{ ...AUTH_TITLE, fontSize: 24 }}>{t("forgotPasswordTitle")}</h1>
      <p style={{ ...AUTH_SUBTITLE, lineHeight: "20px" }}>{t("forgotPasswordDescription")}</p>

      {sent ? (
        <div className="flex flex-col items-center" style={{ marginTop: 8 }}>
          <span
            className="flex items-center justify-center rounded-full"
            style={{ width: 64, height: 64, marginBottom: 16, background: "var(--status-success-bg)", color: "var(--status-success)" }}
          >
            <Check size={32} />
          </span>
          <p className="text-center font-medium" style={{ fontSize: 14, lineHeight: "20px", color: "var(--status-success)" }}>
            {t("forgotPasswordSuccess")}
          </p>
          <button type="button" onClick={onBack} className={AUTH_LINK_ROW} style={{ marginTop: 24, minHeight: 44 }}>
            <span style={{ ...AUTH_LINK, fontWeight: 600 }}>{t("signIn")}</span>
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("username")}
            aria-label={t("username")}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            autoFocus
            className={AUTH_INPUT_CLASS}
            style={AUTH_INPUT_STYLE}
          />
          <PrimaryCta type="submit" disabled={!canSubmit} loading={sending} style={{ marginTop: 22 }}>
            {t("sendRequest")}
          </PrimaryCta>
          <button type="button" onClick={onBack} className={AUTH_LINK_ROW} style={{ marginTop: 16, minHeight: 44 }}>
            <span style={AUTH_LINK}>{t("signIn")}</span>
          </button>
        </form>
      )}
    </>
  );
}
