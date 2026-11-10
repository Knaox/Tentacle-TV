import { useTranslation } from "react-i18next";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";

interface UpdateActionsProps {
  isStoreUpdate: boolean;
  storeOpened: boolean;
  error: string | null;
  onInstall: () => void;
  onDismiss: () => void;
}

/**
 * Les boutons de la phase « disponible », l'encart d'erreur et le rappel App Store.
 *
 * Deux pilules du socle : « Plus tard » (discrète) et l'action principale NEUTRE — mettre à
 * jour n'est pas lire, le dégradé du logo ne lui revient pas. Après un échec, elle dit
 * « Réessayer » : c'est le même geste, relancé.
 */
export function UpdateActions({ isStoreUpdate, storeOpened, error, onInstall, onDismiss }: UpdateActionsProps) {
  const { t } = useTranslation("notifications");
  const primary = isStoreUpdate
    ? t("notifications:updateOpenStore")
    : error ? t("notifications:updateRetry") : t("notifications:updateNow");
  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-tile bg-danger-surface px-4 py-3">
          <WarningCircleIcon size={20} weight="fill" className="mt-0.5 flex-shrink-0 text-status-error-fg" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-status-error-fg">{t("notifications:updateErrorTitle")}</p>
            {/* Les codes connus de la coquille arrivent sous forme de clé i18n
                (cf. `updateErrorLabel`). Le reste est un message brut : on
                l'affiche tel quel plutôt que de taire l'erreur. */}
            <p className="mt-0.5 break-words text-sm text-content-secondary">
              {error.startsWith("notifications:") ? t(error) : error}
            </p>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDismiss} className="btn btn-ghost">
          {t("notifications:later")}
        </button>
        <button type="button" onClick={onInstall} className="btn btn-solid" data-update-primary>
          {primary}
        </button>
      </div>
      {isStoreUpdate && storeOpened && (
        <p className="text-right text-xs text-content-tertiary">{t("notifications:updateStoreOpenedHint")}</p>
      )}
    </div>
  );
}
