import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/**
 * Affiché quand le jumelage TV est indisponible côté backend (URL publique du
 * serveur non configurée). Message adapté : l'admin obtient un raccourci vers le
 * réglage, l'utilisateur simple est invité à contacter l'administrateur.
 */
export function PairingLockedNotice({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation("pairing");
  return (
    <div className="rounded-xl border border-line-subtle bg-fill-faint p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-fill-subtle text-content-tertiary">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
          </svg>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-content-secondary">
          {isAdmin ? t("pairingUnavailableAdmin") : t("pairingUnavailable")}
        </p>
        {isAdmin && (
          <Link
            to="/admin/services#publicurl"
            className="inline-flex h-10 items-center rounded-lg bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg transition hover:bg-cta-primary-bg-hover"
           
          >
            {t("pairingConfigureNow")}
          </Link>
        )}
      </div>
    </div>
  );
}
