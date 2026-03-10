import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { usePinnedNav } from "../hooks/usePinnedNav";

interface Props {
  onClose: () => void;
  isMobile: boolean;
  anchorRect?: DOMRect | null;
}

export function PlusMenu({ onClose, isMobile, anchorRect }: Props) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const { data: libraries } = useLibraries();
  const pinned = usePinnedNav();
  const overlayRef = useRef<HTMLDivElement>(null);

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

  const goAndClose = (path: string) => {
    navigate(path);
    onClose();
  };

  if (isMobile) return createPortal(<MobileSheet onClose={onClose} />, document.body);

  // Desktop: floating panel positioned next to the sidebar
  const top = anchorRect ? anchorRect.top : 200;

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-50">
      <div
        className="absolute overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        style={{
          left: 72,
          top: Math.min(top, window.innerHeight - 420),
          width: 280,
          background: "rgba(12,12,22,0.96)",
          backdropFilter: "blur(24px)",
          animation: "plusMenuIn 180ms ease forwards",
        }}
      >
        <style>{`
          @keyframes plusMenuIn {
            from { opacity: 0; transform: translateX(-8px) scale(0.96); }
            to { opacity: 1; transform: translateX(0) scale(1); }
          }
        `}</style>

        <PanelContent
          libraries={libraries}
          pinned={pinned}
          onNavigate={goAndClose}
          t={t}
        />
      </div>
    </div>,
    document.body
  );
}

function MobileSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const { data: libraries } = useLibraries();
  const pinned = usePinnedNav();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const goAndClose = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ animation: "sheetOverlayIn 200ms ease forwards" }}
    >
      <style>{`
        @keyframes sheetOverlayIn { from { background: transparent; } to { background: rgba(0,0,0,0.5); } }
        @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        ref={sheetRef}
        className="max-h-[75vh] overflow-y-auto rounded-t-3xl border-t border-white/10 safe-area-pb"
        style={{
          background: "rgba(12,12,22,0.98)",
          backdropFilter: "blur(24px)",
          animation: "sheetSlideUp 250ms cubic-bezier(0.32,0.72,0,1) forwards",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <PanelContent
          libraries={libraries}
          pinned={pinned}
          onNavigate={goAndClose}
          t={t}
        />
      </div>
    </div>
  );
}

/* ── Shared panel content ── */

interface PanelContentProps {
  libraries: { Id: string; Name: string; CollectionType?: string }[] | undefined;
  pinned: ReturnType<typeof usePinnedNav>;
  onNavigate: (path: string) => void;
  t: (key: string) => string;
}

function PanelContent({ libraries, pinned, onNavigate, t }: PanelContentProps) {
  return (
    <div className="px-4 pb-5 pt-3">
      {/* ── Quick access: Watchlist & Favorites ── */}
      <div className="mb-4 space-y-1">
        <PinnableRow
          icon={<WatchlistIcon />}
          label={t("nav:myList")}
          isPinned={pinned.watchlist}
          onTogglePin={pinned.toggleWatchlist}
          onNavigate={() => onNavigate("/watchlist")}
        />
        <PinnableRow
          icon={<HeartIcon />}
          label={t("nav:myFavorites")}
          isPinned={pinned.favorites}
          onTogglePin={pinned.toggleFavorites}
          onNavigate={() => onNavigate("/favorites")}
        />
      </div>

      {/* ── Separator ── */}
      <div className="mx-1 mb-3 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)" }} />

      {/* ── Libraries ── */}
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/30">
        {t("nav:libraries")}
      </p>
      <div className="space-y-1">
        {libraries?.map((lib) => (
          <PinnableRow
            key={lib.Id}
            icon={lib.CollectionType === "movies" ? <FilmSmIcon /> : <TvSmIcon />}
            label={lib.Name}
            isPinned={pinned.isLibraryPinned(lib.Id)}
            onTogglePin={() => pinned.toggleLibrary(lib.Id)}
            onNavigate={() => onNavigate(`/library/${lib.Id}`)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Pinnable row ── */

function PinnableRow({
  icon,
  label,
  isPinned,
  onTogglePin,
  onNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  isPinned: boolean;
  onTogglePin: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-xl transition-colors hover:bg-white/[0.04]">
      <button
        onClick={onNavigate}
        className="flex flex-1 items-center gap-3 py-2.5 pl-3 text-left text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        <span className="flex-shrink-0 text-white/40">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        className={`mr-2 flex-shrink-0 rounded-lg p-2 transition-all ${
          isPinned
            ? "text-purple-400 hover:bg-purple-500/10"
            : "text-white/25 hover:bg-white/5 hover:text-white/50"
        }`}
        title={isPinned ? "Unpin" : "Pin"}
      >
        <PinIcon filled={isPinned} />
      </button>
    </div>
  );
}

/* ── Icons ── */

function PinIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M16 3a1 1 0 0 0-.707.293l-2.414 2.414-3.172-.793A1 1 0 0 0 8.7 5.5L10.5 10.5l-3.793 3.793-2.56-.64a1 1 0 0 0-.854 1.7l5.354 5.354a1 1 0 0 0 1.7-.854l-.64-2.56L13.5 13.5l5 1.8a1 1 0 0 0 .586-1.007l-.793-3.172 2.414-2.414A1 1 0 0 0 20 7l-3-3A1 1 0 0 0 16 3z" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3l4 4-3 3 1 4-5-1.8-4.5 4.5.8 3.2-6-6 3.2.8L11 10.2 9.2 5.2l4 1L16 3z" />
    </svg>
  );
}

function WatchlistIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function FilmSmIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  );
}

function TvSmIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
