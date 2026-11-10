import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { BACKEND, hdrs, creds } from "../../pages/adminUtils";
import { getImpersonationState } from "../../lib/impersonation";

/** Le champ du socle (40 px) ; la marge de droite laisse sa place à l'œil. */
const INPUT = "field pr-11";

/**
 * Section "Mot de passe" du profil (web + desktop) — change le mot de passe
 * Jellyfin du compte connecté via POST /api/auth/change-password (le backend
 * fait valider le mot de passe actuel par Jellyfin). Masquée pendant une
 * session d'impersonation : le backend la refuserait de toute façon (403).
 */
export function ChangePasswordSection({ embedded = false }: {
  /** Posé dans une ligne des réglages du web large (`SettingItem`), qui porte déjà le titre et l'explication. */
  embedded?: boolean;
} = {}) {
  const { t } = useTranslation(["preferences", "common"]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (getImpersonationState()) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next.length < 6) {
      setError(t("preferences:passwordTooShort"));
      return;
    }
    if (next !== confirmNext) {
      setError(t("preferences:passwordMismatch"));
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/change-password`, {
        method: "POST",
        headers: hdrs(),
        credentials: creds(),
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.message || t("preferences:passwordChangeError"));
        return;
      }
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirmNext("");
    } catch {
      setError(t("preferences:passwordChangeError"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={embedded ? "" : "lg-content ui-panel mt-8 p-5"}>
      {!embedded && (
        <>
          <h3 className="mb-1 text-sm font-semibold text-content-primary">{t("preferences:changePasswordTitle")}</h3>
          <p className="mb-4 text-xs text-content-tertiary">{t("preferences:changePasswordDescription")}</p>
        </>
      )}

      <form onSubmit={handleSubmit} className="max-w-sm space-y-3.5">
        <PasswordField
          id="current-password"
          label={t("preferences:currentPassword")}
          value={current}
          onChange={setCurrent}
          show={show}
          onToggleShow={() => setShow(!show)}
          toggleLabel={show ? t("preferences:hidePassword") : t("preferences:showPassword")}
          autoComplete="current-password"
        />
        <PasswordField
          id="new-password"
          label={t("preferences:newPassword")}
          value={next}
          onChange={setNext}
          show={show}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-new-password"
          label={t("preferences:confirmNewPassword")}
          value={confirmNext}
          onChange={setConfirmNext}
          show={show}
          autoComplete="new-password"
        />

        {error && (
          <p className="text-sm text-[var(--status-error-fg)]" role="alert">{error}</p>
        )}
        {success && (
          <p className="text-sm text-[var(--status-success-fg)]" role="status">
            {t("preferences:passwordChanged")}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !current || !next || !confirmNext}
          className="btn btn-solid"
         
        >
          {pending ? t("preferences:passwordChanging") : t("common:save")}
        </button>
      </form>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, show, onToggleShow, toggleLabel, autoComplete }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow?: () => void;
  toggleLabel?: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-content-tertiary">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          required
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
          autoComplete={autoComplete}
        />
        {onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            aria-label={toggleLabel}
            className="icon-btn btn-sm absolute right-1 top-1/2 -translate-y-1/2"
          >
            {show ? <EyeSlashIcon size={17} aria-hidden /> : <EyeIcon size={17} aria-hidden />}
          </button>
        )}
      </div>
    </div>
  );
}
