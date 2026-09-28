import { memo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bookmark, Compass, Search, Undo2 } from "lucide-react";
import { useRestoreWatchlistItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMirrorChrome } from "../../useMirrorLayout";
import { TAB_BAR_TOTAL } from "../../shell/metrics";
import { CollectionEmptyState } from "../collection/CollectionStates";

/**
 * Liste vide : ce que la page promet, et deux chemins pour la remplir — dans
 * l'état vide commun des collections (emblème du catalogue).
 */
export const WatchlistEmptyState = memo(function WatchlistEmptyState() {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  return (
    <CollectionEmptyState
      Icon={Bookmark}
      title={tc("emptyWatchlist")}
      body={t("emptyBody")}
      primary={{ label: t("emptyExplore"), Icon: Compass, onPress: () => navigate("/") }}
      secondary={{ label: t("emptySearch"), Icon: Search, onPress: () => navigate("/search") }}
    />
  );
});

/**
 * « Titre a quitté Ma liste — Annuler », au-dessus de la barre d'onglets.
 * Monté seulement quand il a quelque chose à dire ; disparaît seul en 6 s.
 */
export function UndoBar({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const { t } = useTranslation("watchlist");
  const restore = useRestoreWatchlistItem(item);
  const chrome = useMirrorChrome();
  const bottom = chrome !== "tabs" ? "max(env(safe-area-inset-bottom, 0px), 12px)" : `calc(${TAB_BAR_TOTAL} + 8px)`;

  useEffect(() => {
    const timer = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timer);
  }, [item, onClose]);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3" style={{ bottom }}>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-[520px] items-center gap-2 rounded-2xl border border-line-strong bg-surface-1 py-1.5 pl-4 pr-1.5 shadow-2xl"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{t("removed", { title: item.Name })}</span>
        <button
          type="button"
          onClick={() => { restore.mutate(); onClose(); }}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-brand-light"
        >
          <Undo2 size={16} aria-hidden /> {t("undo")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
