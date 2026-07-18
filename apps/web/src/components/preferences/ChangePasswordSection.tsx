import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, hdrs, creds } from "../../pages/adminUtils";
import { getImpersonationState } from "../../lib/impersonation";

const INPUT =
  "h-11 w-full rounded-lg border border-line-subtle bg-tentacle-surface px-3 pr-11 text-sm text-content-primary outline-none transition placeholder:text-content-quaternary focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/30";

/**
 * Section "Mot de passe" du profil (web + desktop) — change le mot de passe
 * Jellyfin du compte connecté via POST /api/auth/change-password (le backend
 * fait valider le mot de passe actuel par Jellyfin). Masquée pendant une
 * session d'impersonation : le backend la refuserait de toute façon (403).
 */
export function ChangePasswordSection() {
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
    <div className="mt-8 rounded-xl border border-line-subtle bg-fill-subtle p-5">
      <h3 className="mb-1 text-sm font-semibold text-content-primary">{t("preferences:changePasswordTitle")}</h3>
      <p className="mb-4 text-xs text-content-tertiary">{t("preferences:changePasswordDescription")}</p>

      <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
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
          className="inline-flex h-11 items-center justify-center rounded-lg bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg transition hover:bg-cta-primary-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
         
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
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-content-tertiary">{label}</label>
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
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-content-quaternary transition hover:bg-fill-soft hover:text-content-secondary"
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}
