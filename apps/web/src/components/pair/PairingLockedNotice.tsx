import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LockIcon } from "@phosphor-icons/react/dist/csr/Lock";

/**
 * Affiché quand aucune adresse du serveur ne peut être donnée à une TV (rien
 * d'annoncé, et la page est ouverte par `localhost` — `fetchPairingServerUrl`).
 * Message adapté : l'admin obtient un raccourci vers le réglage, l'utilisateur
 * simple est invité à contacter l'administrateur.
 */
export function PairingLockedNotice({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation("pairing");
  return (
    <div className="ui-panel p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-content-tertiary">
          <LockIcon size={28} aria-hidden />
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-content-secondary">
          {isAdmin ? t("pairingUnavailableAdmin") : t("pairingUnavailable")}
        </p>
        {isAdmin && (
          <Link
            to="/admin/services#publicurl"
            className="btn btn-solid"
          >
            {t("pairingConfigureNow")}
          </Link>
        )}
      </div>
    </div>
  );
}
