import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSearchItems, useJellyfinClient, useAddSharedWatchlistItem } from "@tentacle-tv/api-client";

interface Props {
  watchlistId: string;
  watchlistName?: string;
  onClose: () => void;
}

export function AddMediaModal({ watchlistId, onClose }: Props) {
  const { t } = useTranslation("common");
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useSearchItems(query);
  const addItem = useAddSharedWatchlistItem(watchlistId);
  const client = useJellyfinClient();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => { if (e.target === overlayRef.current) onClose(); },
    [onClose]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [handleClickOutside, onClose]);

  const handleAdd = (itemId: string) => {
    addItem.mutate(
      { jellyfinItemId: itemId },
      {
        onSuccess: () => {
          setToast(t("common:itemAddedToLists", { count: 1 }));
          setTimeout(() => setToast(null), 2500);
        },
      }
    );
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ animation: "modalFadeIn 200ms ease forwards" }}
    >
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div
        className="mx-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12121a]/95 shadow-2xl backdrop-blur-lg sm:mx-0"
        style={{ animation: "modalSlideUp 250ms ease forwards", maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{t("common:addMedia")}</h2>
          <button onClick={onClose} className="text-white/40 transition-colors hover:text-white/80">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="border-b border-white/5 px-6 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common:searchMedia")}
            className="w-full rounded-lg bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {query.length < 2 ? (
            <p className="py-8 text-center text-sm text-white/30">{t("common:typeMinChars")}</p>
          ) : isLoading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : !results || results.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/30">{t("common:noResults")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {results.map((item) => (
                <button
                  key={item.Id}
                  onClick={() => handleAdd(item.Id)}
                  className="group relative overflow-hidden rounded-lg transition-transform hover:scale-105"
                >
                  <img
                    src={client.getImageUrl(item.Id, "Primary", { height: 300, quality: 80 })}
                    alt={item.Name}
                    className="aspect-[2/3] w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="w-full p-2">
                      <p className="truncate text-xs font-medium text-white">{item.Name}</p>
                      {item.ProductionYear && (
                        <p className="text-xs text-white/50">{item.ProductionYear}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-purple-500/90 px-5 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          {toast}
        </div>
      )}
    </div>,
    document.body
  );
}
