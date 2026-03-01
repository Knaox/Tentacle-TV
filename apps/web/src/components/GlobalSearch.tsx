import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSearchItems, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

export function GlobalSearch() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);

  const { data: results, isLoading } = useSearchItems(debounced);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Ctrl+K or /
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === "k") || (e.key === "/" && !(e.target instanceof HTMLInputElement))) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Mobile tab bar integration
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener("open-global-search", handler);
    return () => window.removeEventListener("open-global-search", handler);
  }, []);

  const handleSelect = (item: MediaItem) => {
    setOpen(false);
    setInput("");
    navigate(`/media/${item.Id}`);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Collapsed: search button */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-all duration-300"
          style={{
            width: 220,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          <SearchIcon />
          <span className="hidden flex-1 text-left sm:inline">{t("common:searchPlaceholder")}</span>
          <kbd
            className="hidden rounded px-1.5 py-0.5 text-[10px] text-white/20 sm:inline"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {t("common:ctrlK")}
          </kbd>
        </button>
      )}

      {/* Expanded: input + dropdown */}
      {open && (
        <div style={{ width: 320 }} className="transition-all duration-300">
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(139,92,246,0.3)",
              backdropFilter: "blur(12px)",
            }}
          >
            <SearchIcon focused />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("common:searchMediaLong")}
              className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/30 outline-none"
              autoFocus
            />
          </div>

          {/* Results dropdown */}
          {debounced.length >= 2 && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl animate-fade-slide-down"
              style={{
                background: "rgba(15,15,25,0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              }}
            >
              {isLoading && (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-tentacle-accent border-t-transparent" />
                </div>
              )}

              {!isLoading && (!results || results.length === 0) && (
                <p className="py-6 text-center text-sm text-white/40">{t("common:noResults")}</p>
              )}

              {!isLoading && results && results.length > 0 && (
                <div className="py-2">
                  {results.slice(0, 8).map((item) => (
                    <SearchResultItem key={item.Id} item={item} onSelect={handleSelect} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultItem({ item, onSelect }: { item: MediaItem; onSelect: (item: MediaItem) => void }) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const poster = client.getImageUrl(item.Id, "Primary", { height: 80, quality: 80 });
  const year = item.ProductionYear;
  const type = item.Type === "Movie" ? t("common:movie") : item.Type === "Series" ? t("common:series") : item.Type;

  return (
    <button
      onClick={() => onSelect(item)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-white/5"
    >
      <img src={poster} alt="" className="h-12 w-8 flex-shrink-0 rounded object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.Name}</p>
        <p className="text-xs text-white/40">
          {type}
          {year ? ` — ${year}` : ""}
        </p>
      </div>
    </button>
  );
}

function SearchIcon({ focused }: { focused?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-colors duration-200 ${focused ? "text-white/70" : "text-white/30"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
