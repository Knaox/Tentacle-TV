import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface Props {
  count: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onMarkWatched: () => void;
  onMarkUnwatched: () => void;
  isBusy: boolean;
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
}: Props) {
  const { t } = useTranslation("common");
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#12121a]/95 backdrop-blur-lg"
      style={{ animation: "slideUp 0.25s ease" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <span className="text-sm font-medium text-white/70">
          {t("common:selectedCount", { count })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t("common:selectAll")}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t("common:cancel")}
          </button>
          <button
            onClick={onMarkWatched}
            disabled={count === 0 || isBusy}
            className="rounded-lg bg-tentacle-accent/20 px-4 py-1.5 text-sm font-medium text-tentacle-accent ring-1 ring-tentacle-accent/30 transition-all hover:bg-tentacle-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("common:markWatched")}
          </button>
          <button
            onClick={onMarkUnwatched}
            disabled={count === 0 || isBusy}
            className="rounded-lg bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 ring-1 ring-white/10 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("common:markUnwatched")}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>,
    document.body,
  );
}
