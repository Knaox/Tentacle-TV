import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface DetailPlaceholderProps {
  /** La requête de l'item a échoué et la fiche n'a rien à montrer. */
  failed: boolean;
  /** Une nouvelle tentative est en cours. */
  retrying: boolean;
  onRetry: () => void;
}

/**
 * Ce que la fiche montre tant qu'elle n'a pas son item : l'attente, ou l'échec.
 *
 * **Un échec n'est pas une attente.** La fiche ne distinguait pas les deux :
 * `isLoading || !item` gardait le spinner, si bien qu'une requête en erreur —
 * un 500 de Jellyfin, un 404, une coupure au-delà des reprises — le laissait
 * tourner À VIE. Sur un téléviseur : un rond de 40 px sur fond noir, le focus
 * sur `<body>` et rien à viser (reproduit au simulateur webOS 25, toujours là
 * une fois la panne levée). On dit ce qui se passe, et l'on offre de réessayer
 * ou de revenir.
 *
 * Le focus va sur « Réessayer » quand personne ne le tient : sur une dalle,
 * l'échec arrive après les reprises réseau, bien au-delà du délai où le moteur
 * pose lui-même l'anneau d'un écran. Le bouton n'est jamais désactivé pendant
 * la tentative — un élément focalisé qu'on désactive perd le focus, et
 * l'anneau avec lui.
 */
export function DetailPlaceholder({ failed, retrying, onRetry }: DetailPlaceholderProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!failed) return;
    const active = document.activeElement;
    if (!active || active === document.body) primary.current?.focus();
  }, [failed]);

  if (!failed) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line-strong border-t-content-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface-0 px-8 text-center" role="alert">
      <h1 className="text-2xl font-semibold text-content-primary md:text-3xl">{t("contentErrorTitle")}</h1>
      <p className="mt-3 max-w-md text-sm text-content-tertiary">{t("contentErrorMessage")}</p>
      <div className="mt-8 flex items-center">
        <button
          ref={primary}
          type="button"
          onClick={retrying ? undefined : onRetry}
          aria-busy={retrying}
          className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-cta-primary-bg px-7 py-3 text-sm font-bold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
        >
          {retrying ? t("retrying") : t("retry")}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ml-3 inline-flex min-w-[140px] items-center justify-center rounded-full border border-line-strong bg-fill-subtle px-7 py-3 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
}
