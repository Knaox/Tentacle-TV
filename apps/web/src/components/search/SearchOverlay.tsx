import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSearchItems, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen, blurred-black search experience.
 * Replaces the legacy inline dropdown — cleaner, more cinematic,
 * and lets the input go genuinely large for thumb-friendly mobile typing.
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { t } = useTranslation("common");
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounce input (350ms) so we don't fire a search on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setDebounced(input.trim()), 350);
    return () => clearTimeout(id);
  }, [input]);

  // Auto-focus input when overlay opens; reset query on close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setInput("");
      setDebounced("");
    }
  }, [open]);

  const { data: results, isLoading } = useSearchItems(debounced);
  const visibleResults = results?.slice(0, 24) ?? [];

  const handleSelect = (it: MediaItem) => {
    onClose();
    navigate(`/media/${it.Id}`);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        animation: "fadeIn 200ms ease-out",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("common:searchPlaceholder")}
      onClick={onClose}
    >
      {/* Header — input + close */}
      <div
        className="row-gutter flex items-center gap-4 border-b border-white/[0.06] py-5"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}
      >
        <SearchIcon className="h-6 w-6 flex-shrink-0 text-white/55" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("common:searchMediaLong")}
          className="flex-1 bg-transparent text-2xl font-light text-white placeholder-white/30 outline-none md:text-3xl"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Results body */}
      <div
        className="row-gutter flex-1 overflow-y-auto pb-12 pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        {debounced.length < 2 && (
          <p className="pt-4 text-center text-sm text-white/35">
            {t("common:searchPlaceholder")}
          </p>
        )}

        {debounced.length >= 2 && isLoading && (
          <div className="flex justify-center pt-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          </div>
        )}

        {debounced.length >= 2 && !isLoading && (!results || results.length === 0) && (
          <p className="pt-12 text-center text-sm text-white/45">{t("common:noResults")}</p>
        )}

        {debounced.length >= 2 && visibleResults.length > 0 && (
          <ResultsGrid items={visibleResults} onSelect={handleSelect} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function ResultsGrid({
  items,
  onSelect,
}: {
  items: MediaItem[];
  onSelect: (it: MediaItem) => void;
}) {
  return (
    <ul
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
    >
      {items.map((it, i) => (
        <ResultCard key={it.Id} item={it} index={i} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function ResultCard({
  item,
  index,
  onSelect,
}: {
  item: MediaItem;
  index: number;
  onSelect: (it: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const isEpisode = item.Type === "Episode";
  const imageId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const imageUrl = client.getImageUrl(imageId, "Primary", { height: 360, quality: 85 });
  const type =
    item.Type === "Movie" ? t("common:movie") :
    item.Type === "Series" ? t("common:series") :
    item.Type;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="group/r block w-full text-left"
        style={{
          animation: "fadeSlideUp 0.4s ease both",
          animationDelay: `${Math.min(index * 30, 300)}ms`,
        }}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-1">
          <img
            src={imageUrl}
            alt={item.Name}
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-300 group-hover/r:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        </div>
        <p className="mt-2 truncate text-sm font-medium text-white/90">{item.Name}</p>
        <p className="text-xs text-white/45">
          {type}
          {item.ProductionYear ? ` · ${item.ProductionYear}` : ""}
        </p>
      </button>
    </li>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
