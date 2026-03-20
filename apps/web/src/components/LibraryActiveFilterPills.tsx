import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import { PLATFORMS } from "../hooks/usePlatformFilter";
import type { LibraryFilterState } from "./LibraryFilters";

interface Props {
  libraryId: string;
  filters: LibraryFilterState;
  hasActiveFilters: boolean;
  totalResults: number | undefined;
  onRemoveGenre: (id: string) => void;
  onClearPlatform: (id: number) => void;
  onClearYears: () => void;
  onClearRating: () => void;
  onReset: () => void;
}

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#8b5cf6]/15 px-2.5 py-1 text-[11px] font-medium text-[#8b5cf6]">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-white">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

export function LibraryActiveFilterPills({
  libraryId, filters, hasActiveFilters, totalResults,
  onRemoveGenre, onClearPlatform, onClearYears, onClearRating, onReset,
}: Props) {
  const { t } = useTranslation("common");
  const { data: genres } = useGenres(libraryId);

  if (!hasActiveFilters) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {totalResults != null && (
        <span className="mr-1 text-xs font-medium text-white/40">
          {t("resultCount", { count: totalResults })}
        </span>
      )}

      {/* Genre pills */}
      {filters.genreIds.map((gId) => {
        const genre = genres?.find((g) => g.Id === gId);
        return genre ? (
          <Pill key={`g-${gId}`} label={genre.Name} onRemove={() => onRemoveGenre(gId)} />
        ) : null;
      })}

      {/* Platform pills */}
      {filters.platformIds.map((pid) => {
        const p = PLATFORMS.find((pl) => pl.id === pid);
        return p ? <Pill key={`p-${pid}`} label={p.name} onRemove={() => onClearPlatform(pid)} /> : null;
      })}

      {/* Year pill */}
      {(filters.yearFrom != null || filters.yearTo != null) && (
        <Pill label={`${filters.yearFrom ?? "..."} — ${filters.yearTo ?? "..."}`} onRemove={onClearYears} />
      )}

      {/* Rating pill */}
      {filters.ratingMin != null && (
        <Pill label={`${filters.ratingMin.toFixed(1)}+`} onRemove={onClearRating} />
      )}

      {/* Favoris pill */}
      {filters.isFavorite && (
        <Pill label={`♥ ${t("favorites")}`} onRemove={() => {}} />
      )}

      {/* Status pill */}
      {filters.statusFilter && (
        <Pill
          label={filters.statusFilter === "IsUnplayed" ? t("unwatched") : t("inProgress")}
          onRemove={() => {}}
        />
      )}

      <button
        onClick={onReset}
        className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white/30 transition-colors hover:text-white/60"
      >
        {t("resetFilters")}
      </button>
    </div>
  );
}
