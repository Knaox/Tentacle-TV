import { useTranslation } from "react-i18next";

/**
 * L'attente de la porte de « Qui regarde ? » quand le sélecteur est EXIGÉ (la
 * session d'un profil a pris fin) : rien de l'application avant la réponse du
 * serveur, jamais le compte sans son code. Le fond de l'application, un
 * anneau, et ce qui vient : le choix d'un profil.
 */
export function LaunchSplash() {
  const { t } = useTranslation("profilePicker");
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-0 text-sm text-content-tertiary">
      <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-[3px] border-line-subtle border-t-[var(--brand)]" />
      {t("loading")}
    </div>
  );
}
