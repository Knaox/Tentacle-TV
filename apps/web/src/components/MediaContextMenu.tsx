import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useFavorite, useToggleWatchlist, useAppConfig } from "@tentacle-tv/api-client";
import { SharedWatchlistPicker } from "./SharedWatchlistPicker";

interface Props {
  itemId: string;
  isFavorite: boolean;
  isInWatchlist: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onToggleFavorite?: () => void;
  onToggleWatchlist?: () => void;
}

export function MediaContextMenu({ itemId, isFavorite, isInWatchlist, x, y, onClose, onToggleFavorite, onToggleWatchlist }: Props) {
  const { t } = useTranslation("common");
  const menuRef = useRef<HTMLDivElement>(null);
  const { add: addFav, remove: removeFav } = useFavorite(itemId);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(itemId);
  const { data: config } = useAppConfig();
  const [showSharedPicker, setShowSharedPicker] = useState(false);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSharedPicker) setShowSharedPicker(false);
        else onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [handleClickOutside, onClose, showSharedPicker]);

  // Clamp position to viewport
  const clampedX = Math.min(x, window.innerWidth - 260);
  const clampedY = Math.min(y, window.innerHeight - 200);

  const toggleFavorite = () => {
    if (isFavorite) removeFav.mutate();
    else addFav.mutate();
    onToggleFavorite?.();
    onClose();
  };

  const toggleWatchlist = () => {
    if (isInWatchlist) removeWatchlist.mutate();
    else addWatchlist.mutate();
    onToggleWatchlist?.();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={t("common:moreInfo")}
      className="fixed z-50 min-w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[#12121a]/95 shadow-2xl backdrop-blur-lg"
      style={{
        left: clampedX,
        top: clampedY,
        animation: "ctxMenuIn 150ms ease forwards",
      }}
    >
      <style>{`
        @keyframes ctxMenuIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes ctxPickerSlide {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 300px; }
        }
      `}</style>

      <button
        role="menuitem"
        onClick={toggleFavorite}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
      >
        <HeartSmall filled={isFavorite} />
        {isFavorite ? t("common:removeFromFavorites") : t("common:addToFavorites")}
      </button>

      <div className="mx-3 border-t border-white/5" />

      <button
        role="menuitem"
        onClick={toggleWatchlist}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
      >
        <BookmarkSmall filled={isInWatchlist} />
        {isInWatchlist ? t("common:removeFromMyList") : t("common:addToMyList")}
      </button>

      {config?.features.sharedWatchlists && (
        <>
          <div className="mx-3 border-t border-white/5" />

          <button
            role="menuitem"
            onClick={() => setShowSharedPicker(!showSharedPicker)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            <ListPlusSmall />
            {t("common:addToSharedList")}
          </button>

          {showSharedPicker && (
            <div style={{ animation: "ctxPickerSlide 200ms ease forwards", overflow: "hidden" }}>
              <div className="mx-3 border-t border-white/5" />
              <SharedWatchlistPicker itemId={itemId} onDone={onClose} />
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
}

function HeartSmall({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
  ) : (
    <svg className="h-4 w-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
  );
}

function BookmarkSmall({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z" /></svg>
  ) : (
    <svg className="h-4 w-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
  );
}

function ListPlusSmall() {
  return (
    <svg className="h-4 w-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h6m3 0h3m-1.5-1.5v3" />
    </svg>
  );
}
