import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import type { LibraryFilterState } from "./LibraryFilters";
import { PLATFORMS } from "../hooks/usePlatformFilter";

interface LibraryFilterPanelProps {
  open: boolean;
  onClose: () => void;
  libraryId: string;
  filters: LibraryFilterState;
  onToggleGenre: (id: string) => void;
  onTogglePlatform: (id: number) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onSortByChange: (v: string) => void;
  onSortOrderChange: (v: string) => void;
  onReset: () => void;
  activeFilterCount: number;
}

const SORT_OPTIONS = [
  { value: "DateCreated", key: "sortDateDesc" },
  { value: "SortName", key: "sortTitleAsc" },
  { value: "ProductionYear", key: "sortYear" },
  { value: "CommunityRating", key: "sortRatingDesc" },
] as const;

export function LibraryFilterPanel({
  open, onClose, libraryId, filters,
  onToggleGenre, onTogglePlatform,
  onYearFromChange, onYearToChange, onRatingMinChange,
  onSortByChange, onSortOrderChange, onReset, activeFilterCount,
}: LibraryFilterPanelProps) {
  const { t } = useTranslation("common");
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: genres } = useGenres(libraryId);


  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const parseYear = (val: string): number | null => {
    if (!val) return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  };

  const ratingCurrent = filters.ratingMin ?? 0;

  return (
    <>
      {/* Backdrop — exact Seer style */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: "fadeIn 300ms ease forwards",
          }}
        />
      )}

      {/* Panel — exact Seer style */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 flex h-full w-full max-w-sm flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          zIndex: 101,
          background: "rgba(18,18,26,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5), -2px 0 8px rgba(0,0,0,0.3)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">{t("filters")}</h3>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8b5cf6] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button onClick={onReset} className="text-xs text-[#8b5cf6] hover:text-purple-300">
                {t("resetFilters")}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: "thin", scrollbarColor: "#8b5cf6 transparent" }}>
          {/* Sort */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              {t("sortBy")}
            </h4>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortByChange(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filters.sortBy === opt.value
                      ? "bg-[#8b5cf6] text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  {t(opt.key)}
                </button>
              ))}
              <button
                onClick={() => onSortOrderChange(filters.sortOrder === "Descending" ? "Ascending" : "Descending")}
                className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
                title={filters.sortOrder === "Descending" ? t("sortOrderDesc") : t("sortOrderAsc")}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {filters.sortOrder === "Descending" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Genres — exact Seer GenreFilter style */}
          {genres && genres.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                {t("genres")}
              </h4>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => {
                  const active = filters.genreIds.includes(g.Id);
                  return (
                    <button
                      key={g.Id}
                      onClick={() => onToggleGenre(g.Id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-[#8b5cf6]/20 text-[#8b5cf6] ring-1 ring-[#8b5cf6]/50"
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                      }`}
                    >
                      {g.Name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Plateformes — exact Seer PlatformFilter style */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Plateformes
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => {
                const active = filters.platformIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => onTogglePlatform(p.id)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-[#8b5cf6]"
                        : "border border-white/5 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {active && (
                      <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Year — exact Seer YearRangeFilter style */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              {t("sortYear")}
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1900}
                max={2030}
                placeholder={t("yearFrom")}
                value={filters.yearFrom ?? ""}
                onChange={(e) => onYearFromChange(parseYear(e.target.value))}
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-purple-500/40"
              />
              <span className="text-xs text-white/30">&mdash;</span>
              <input
                type="number"
                min={1900}
                max={2030}
                placeholder={t("yearTo")}
                value={filters.yearTo ?? ""}
                onChange={(e) => onYearToChange(parseYear(e.target.value))}
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-purple-500/40"
              />
            </div>
          </div>

          {/* Rating — exact Seer RatingSlider style */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                {t("ratingMin")}
              </h4>
              <span className="text-xs font-medium text-white/60">
                {ratingCurrent > 0 ? `${ratingCurrent.toFixed(1)}+` : t("ratingAny")}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={ratingCurrent}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onRatingMinChange(v > 0 ? v : null);
              }}
              className="w-full accent-[#8b5cf6]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-white/20">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
