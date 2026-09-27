import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { PLATFORMS } from "../hooks/usePlatformFilter";
import type { LibraryFilterState } from "../hooks/useLibraryFilters";

interface Props {
  /** Les genres, fournis — cf. `GenreMenu` : plus de `ParentId` exigé. */
  genres: Array<{ Id: string; Name: string }>;
  filters: LibraryFilterState;
  hasActiveFilters: boolean;
  totalResults: number | undefined;
  onRemoveGenre: (id: string) => void;
  onClearPlatform: (id: number) => void;
  onClearYears: () => void;
  onClearRating: () => void;
  onReset: () => void;
  /** Lève le filtre de statut (« Non vus », « En cours »). */
  onClearStatus?: () => void;
  /** Lève le filtre Favoris. */
  onClearFavorite?: () => void;
  /**
   * Sous le panneau de la bibliothèque : ni compte ni réinitialisation (le
   * panneau les porte déjà), ni statut ni favoris (le contrôle segmenté les
   * montre), ni années ni note (la pastille de leur menu affiche la valeur).
   * Seulement ce qu'un menu fermé résume : plusieurs genres ou plateformes,
   * que sa pastille réduit à « Genres · 3 ».
   */
  compact?: boolean;
}

function Pill({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const { t } = useTranslation("library");
  return (
    <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-[rgba(var(--brand-rgb),0.14)] py-0.5 pl-3 pr-1 text-[11px] font-semibold text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.35)]">
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("removeFilter", { name: label })}
          className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--brand-rgb),0.3)] hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]"
        >
          <X aria-hidden className="h-3 w-3" strokeWidth={2.6} />
        </button>
      ) : (
        <span className="w-2" aria-hidden />
      )}
    </span>
  );
}

export function LibraryActiveFilterPills({
  genres, filters, hasActiveFilters, totalResults,
  onRemoveGenre, onClearPlatform, onClearYears, onClearRating, onReset,
  onClearStatus, onClearFavorite, compact = false,
}: Props) {
  const { t } = useTranslation(["common", "library"]);

  if (!hasActiveFilters) return null;

  const hasYears = !compact && (filters.yearFrom != null || filters.yearTo != null);
  const showRating = !compact && filters.ratingMin != null;
  const genreIds = compact && filters.genreIds.length < 2 ? [] : filters.genreIds;
  const platformIds = compact && filters.platformIds.length < 2 ? [] : filters.platformIds;
  // En mode compact, une rangée qui n'aurait rien à retirer ne se monte pas.
  if (compact && genreIds.length + platformIds.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("library:activeFilters")}
      className={`flex flex-wrap items-center gap-2 ${compact ? "mt-3" : "mb-4"}`}
    >
      {!compact && totalResults != null && (
        <span className="mr-1 text-xs font-medium tabular-nums text-content-quaternary">
          {t("common:resultCount", { count: totalResults })}
        </span>
      )}

      {genreIds.map((gId) => {
        const genre = genres?.find((g) => g.Id === gId);
        return genre ? <Pill key={`g-${gId}`} label={genre.Name} onRemove={() => onRemoveGenre(gId)} /> : null;
      })}

      {platformIds.map((pid) => {
        const p = PLATFORMS.find((pl) => pl.id === pid);
        return p ? <Pill key={`p-${pid}`} label={p.name} onRemove={() => onClearPlatform(pid)} /> : null;
      })}

      {hasYears && (
        <Pill label={`${filters.yearFrom ?? "..."} — ${filters.yearTo ?? "..."}`} onRemove={onClearYears} />
      )}

      {showRating && filters.ratingMin != null && (
        <Pill label={`${filters.ratingMin.toFixed(1)}+`} onRemove={onClearRating} />
      )}

      {/* Favoris et statut : la croix n'apparaît que si l'appelant sait les
          lever — elle ne faisait rien jusqu'ici. */}
      {!compact && filters.isFavorite && (
        <Pill label={`♥ ${t("common:favorites")}`} onRemove={onClearFavorite} />
      )}

      {!compact && filters.statusFilter && (
        <Pill
          label={filters.statusFilter === "IsUnplayed" ? t("common:unwatched") : t("common:inProgress")}
          onRemove={onClearStatus}
        />
      )}

      {!compact && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-full px-2.5 py-1 text-[11px] font-medium text-content-quaternary transition-colors hover:text-content-tertiary"
        >
          {t("common:resetFilters")}
        </button>
      )}
    </div>
  );
}
