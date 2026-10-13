import { useTranslation } from "react-i18next";

/**
 * L'attente de la porte de « Qui regarde ? » (premier lancement sans miroir,
 * au plus `LAUNCH_CHECK_BUDGET_MS` ; ou la fin d'un profil) : le fond de
 * l'application et un anneau, sans un mot — un compte sans famille ne doit
 * pas lire « Chargement des profils » à l'ouverture. Seule la fin d'un profil
 * le dit, puisque c'est bien le choix d'un profil qui vient.
 */
export function LaunchSplash({ requested }: { requested: boolean }) {
  const { t } = useTranslation("profilePicker");
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-0 text-sm text-content-tertiary">
      <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-[3px] border-line-subtle border-t-[var(--brand)]" />
      {requested ? t("loading") : <span className="sr-only">{t("loading")}</span>}
    </div>
  );
}
