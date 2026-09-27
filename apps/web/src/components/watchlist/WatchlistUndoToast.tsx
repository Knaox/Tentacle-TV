import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Undo2, X } from "lucide-react";
import { useRestoreWatchlistItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

const LIFETIME_MS = 6000;

/**
 * « Retiré de Ma liste — Annuler ». Le retrait d'un geste est immédiat
 * (optimiste) ; l'annulation le remet TEL QU'IL ÉTAIT — sans la remise à
 * zéro d'un titre vu que fait un ajout (cf. `useRestoreWatchlistItem`).
 *
 * MONTÉ seulement quand il a quelque chose à dire : un verre flouté masqué
 * par l'opacité coûterait sa passe de composition à chaque image (CLAUDE.md,
 * coût GPU, règle 1). `aria-live` sans voler le focus.
 */
export function WatchlistUndoToast({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const { t } = useTranslation("watchlist");
  const restore = useRestoreWatchlistItem(item);

  useEffect(() => {
    const timer = window.setTimeout(onClose, LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [item, onClose]);

  const undo = () => {
    restore.mutate();
    onClose();
  };

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 md:bottom-8">
      <div
        role="status"
        aria-live="polite"
        className="watchlist-toast pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl border border-line-subtle bg-surface-toolbar py-2 pl-4 pr-2 shadow-2xl backdrop-blur-xl"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{t("removed", { title: item.Name })}</span>
        <button
          type="button"
          onClick={undo}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-bold text-brand-light transition-colors duration-150 hover:bg-fill-soft"
        >
          <Undo2 size={15} aria-hidden /> {t("undo")}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close", { ns: "common" })}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-quaternary transition-colors duration-150 hover:text-content-primary"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <style>{`@keyframes watchlistToastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.watchlist-toast { animation: watchlistToastIn 0.22s cubic-bezier(0.22,1,0.36,1); }
@media (prefers-reduced-motion: reduce) { .watchlist-toast { animation: none; } }`}</style>
    </div>,
    document.body,
  );
}
