import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchItems, useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 350);
    return () => clearTimeout(t);
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
    const handler = () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); };
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
      {/* Collapsed: search icon button */}
      {!open && (
        <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-2 rounded-xl bg-black/50 px-4 py-2 text-sm text-white/60 ring-1 ring-white/15 backdrop-blur-md transition-all hover:bg-black/70 hover:text-white/80">
          <SearchIcon />
          <span className="hidden sm:inline">Rechercher...</span>
          <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/30 sm:inline">Ctrl+K</kbd>
        </button>
      )}

      {/* Expanded: input + dropdown */}
      {open && (
        <div className="w-64 sm:w-80">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Rechercher un film, une série..."
            className="w-full rounded-xl bg-black/60 px-4 py-2 text-sm text-white placeholder-white/40 outline-none ring-1 ring-purple-500/50 backdrop-blur-md"
            autoFocus
          />

          {/* Results dropdown */}
          {debounced.length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl">
              {isLoading && (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-tentacle-accent border-t-transparent" />
                </div>
              )}

              {!isLoading && (!results || results.length === 0) && (
                <p className="py-6 text-center text-sm text-white/40">Aucun résultat</p>
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
  const client = useJellyfinClient();
  const poster = client.getImageUrl(item.Id, "Primary", { height: 80, quality: 80 });
  const year = item.ProductionYear;
  const type = item.Type === "Movie" ? "Film" : item.Type === "Series" ? "Série" : item.Type;

  return (
    <button onClick={() => onSelect(item)}
      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5">
      <img src={poster} alt="" className="h-12 w-8 flex-shrink-0 rounded object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.Name}</p>
        <p className="text-xs text-white/40">
          {type}{year ? ` — ${year}` : ""}
        </p>
      </div>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
