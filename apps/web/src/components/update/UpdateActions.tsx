import { useTranslation } from "react-i18next";

interface UpdateActionsProps {
  isStoreUpdate: boolean;
  storeOpened: boolean;
  error: string | null;
  onInstall: () => void;
  onDismiss: () => void;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/** Les boutons de la phase « disponible », l'encart d'erreur et le rappel App Store. */
export function UpdateActions({ isStoreUpdate, storeOpened, error, onInstall, onDismiss }: UpdateActionsProps) {
  const { t } = useTranslation("notifications");
  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius-lg)] border border-danger-border bg-danger-surface px-3.5 py-3"
        >
          <p className="text-sm font-semibold text-status-error-fg">{t("notifications:updateErrorTitle")}</p>
          {/* Les codes connus de la coquille arrivent sous forme de clé i18n
              (cf. `updateErrorLabel`). Le reste est un message brut : on
              l'affiche tel quel plutôt que de taire l'erreur. */}
          <p className="mt-0.5 text-sm text-content-secondary">
            {error.startsWith("notifications:") ? t(error) : error}
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onInstall}
          className={`flex-1 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] px-5 py-2.5 text-sm font-bold text-cta-brand-fg shadow-[0_6px_18px_rgba(var(--brand-rgb),0.35)] transition-transform hover:scale-[1.02] motion-reduce:!transform-none ${FOCUS}`}
        >
          {isStoreUpdate ? t("notifications:updateOpenStore") : t("notifications:updateNow")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={`rounded-full bg-fill-subtle px-5 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft ${FOCUS}`}
        >
          {t("notifications:later")}
        </button>
      </div>
      {isStoreUpdate && storeOpened && (
        <p className="text-center text-xs text-content-quaternary">{t("notifications:updateStoreOpenedHint")}</p>
      )}
    </div>
  );
}
