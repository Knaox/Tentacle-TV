import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowUUpLeftIcon as Undo2 } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import { useRestoreWatchlistItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useGlassControl } from "../ui/glass/useGlassControl";

const LIFETIME_MS = 6000;

/**
 * « Retiré de Ma liste — Annuler ». Le retrait d'un geste est immédiat
 * (optimiste) ; l'annulation le remet TEL QU'IL ÉTAIT — sans la remise à
 * zéro d'un titre vu que fait un ajout (cf. `useRestoreWatchlistItem`).
 *
 * MONTÉ seulement quand il a quelque chose à dire : un verre flouté masqué
 * par l'opacité coûterait sa passe de composition à chaque image (CLAUDE.md,
 * coût GPU, règle 1). `aria-live` sans voler le focus. Verre natif : une
 * SURFACE d'un seul ton (`useGlassControl`, lot lg2), comme les autres avis.
 *
 * Hors verre natif : la peau de l'avis du socle (`.ui-toast`, opaque — plus de
 * flou derrière un fond presque plein) ; « Annuler » est la pilule à la teinte
 * franche, lisible dans les deux thèmes sans règle à part.
 */
export function WatchlistUndoToast({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const { t } = useTranslation("watchlist");
  const restore = useRestoreWatchlistItem(item);
  const glass = useGlassControl<HTMLDivElement>({ lens: "regular", scale: "surface" });

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
        ref={glass.ref}
        {...glass.props}
        role="status"
        aria-live="polite"
        className="lg-toast watchlist-toast ui-toast pointer-events-auto max-w-lg gap-2 py-2 pl-4 pr-2"
      >
        {glass.layers}
        <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{t("removed", { title: item.Name })}</span>
        <button type="button" onClick={undo} className="watchlist-toast-undo btn btn-accent btn-sm">
          <Undo2 size={15} weight="bold" aria-hidden /> {t("undo")}
        </button>
        <button type="button" onClick={onClose} aria-label={t("close", { ns: "common" })} className="icon-btn btn-sm">
          <X size={16} aria-hidden />
        </button>
      </div>
      <style>{`@keyframes watchlistToastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.watchlist-toast { animation: watchlistToastIn var(--duration-menu-in) var(--ease-out); }`}</style>
    </div>,
    document.body,
  );
}
