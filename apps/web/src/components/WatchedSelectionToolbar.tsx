import { useTranslation } from "react-i18next";
import { FloatingBar } from "./ui/glass/FloatingBar";

interface Props {
  count: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onMarkWatched: () => void;
  onMarkUnwatched: () => void;
  isBusy: boolean;
  /** Action groupée « télécharger la sélection » (desktop, droit requis) —
   *  bouton rendu UNIQUEMENT quand les deux props sont fournies. */
  onDownload?: () => void;
  downloadLabel?: string;
}

/**
 * Barre flottante d'actions groupées pour la sélection multi-épisodes
 * (marquer vu/non-vu). Portée dans document.body pour échapper aux
 * overflow:hidden parents. Animation slide-up à l'apparition.
 */
export function WatchedSelectionToolbar({
  count,
  onSelectAll,
  onCancel,
  onMarkWatched,
  onMarkUnwatched,
  isBusy,
  onDownload,
  downloadLabel,
}: Props) {
  const { t } = useTranslation("common");
  const counter = (
    <span className="lg-fb-status text-sm font-medium text-content-secondary">
      {t("common:selectedCount", { count })}
    </span>
  );
  const selectAll = (
    <button
      onClick={onSelectAll}
      className="lg-fb-btn rounded-lg bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
    >
      {t("common:selectAll")}
    </button>
  );
  const cancel = (
    <button
      onClick={onCancel}
      className="lg-fb-btn rounded-lg bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
    >
      {t("common:cancel")}
    </button>
  );
  const download = onDownload && downloadLabel && (
    <button
      onClick={onDownload}
      disabled={count === 0 || isBusy}
      className="lg-fb-btn rounded-lg bg-fill-subtle px-4 py-1.5 text-sm font-medium text-content-secondary ring-1 ring-line-subtle transition-all hover:bg-fill-soft hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {downloadLabel}
    </button>
  );
  const watched = (
    <button
      onClick={onMarkWatched}
      disabled={count === 0 || isBusy}
      className="lg-fb-btn lg-fb-primary rounded-lg bg-[rgba(var(--brand-rgb),0.2)] px-4 py-1.5 text-sm font-medium text-tentacle-accent ring-1 ring-[rgba(var(--brand-rgb),0.3)] transition-all hover:bg-[rgba(var(--brand-rgb),0.3)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {t("common:markWatched")}
    </button>
  );
  const unwatched = (
    <button
      onClick={onMarkUnwatched}
      disabled={count === 0 || isBusy}
      className="lg-fb-btn rounded-lg bg-fill-subtle px-4 py-1.5 text-sm font-medium text-content-secondary ring-1 ring-line-subtle transition-all hover:bg-fill-soft disabled:cursor-not-allowed disabled:opacity-40"
    >
      {t("common:markUnwatched")}
    </button>
  );
  // Verre natif : deux capsules qui flottent (lot lg7, R2) — le compte et
  // « Tout sélectionner » | « Annuler », les gestes, « Marquer vu » en tête de
  // la marque. Ailleurs, la bande d'avant, telle quelle.
  return (
    <FloatingBar
      portal
      role="toolbar"
      label={t("common:selectedCount", { count })}
      groups={[<>{counter}{selectAll}</>, <>{cancel}{download}{unwatched}{watched}</>]}
      legacy={
        <div
          className="lg-bar fixed inset-x-0 bottom-0 z-50 border-t border-line-subtle bg-surface-toolbar backdrop-blur-lg"
          style={{ animation: "slideUp 0.25s ease" }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
            {counter}
            <div className="flex items-center gap-2">
              {selectAll}
              {cancel}
              {download}
              {watched}
              {unwatched}
            </div>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      }
    />
  );
}
