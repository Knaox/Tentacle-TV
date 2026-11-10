import { useTranslation } from "react-i18next";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import { languageName } from "@tentacle-tv/shared";
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
  /** Les langues posées (audio, sous-titres) paraissent aussi, chacune retirable. */
  languages?: boolean;
  onClearAudioLang?: () => void;
  onClearSubtitleLang?: () => void;
  /** La marge de la rangée — sous le panneau d'outils, elle suit l'étage des menus. */
  className?: string;
}

/**
 * Un filtre posé : la puce du socle à la teinte franche (un état ACTIF), et sa croix. Sans
 * `onRemove`, la puce informe seulement — l'appelant ne sait pas lever ce filtre-là.
 */
function Pill({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const { t } = useTranslation("library");
  return (
    <span className={`chip chip-accent h-7 ${onRemove ? "gap-0.5 pr-1" : ""}`}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("removeFilter", { name: label })}
          className="flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-hover hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"
        >
          <X weight="bold" aria-hidden size={11} />
        </button>
      )}
    </span>
  );
}

export function LibraryActiveFilterPills({
  genres, filters, hasActiveFilters, totalResults,
  onRemoveGenre, onClearPlatform, onClearYears, onClearRating, onReset,
  onClearStatus, onClearFavorite, compact = false,
  languages = false, onClearAudioLang, onClearSubtitleLang, className,
}: Props) {
  const { t, i18n } = useTranslation(["common", "library"]);

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
      className={`flex flex-wrap items-center gap-1.5 ${className ?? (compact ? "mt-3" : "mb-4")}`}
    >
      {!compact && totalResults != null && (
        <span className="mr-1 text-[13px] font-semibold tabular-nums text-content-tertiary">
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
        <Pill label={`${filters.yearFrom ?? "…"} — ${filters.yearTo ?? "…"}`} onRemove={onClearYears} />
      )}

      {showRating && filters.ratingMin != null && (
        <Pill label={`★ ${filters.ratingMin.toFixed(1)}+`} onRemove={onClearRating} />
      )}

      {languages && filters.audioLang && (
        <Pill label={`${t("common:filterAudioLanguage")} · ${languageName(filters.audioLang, i18n.language)}`} onRemove={onClearAudioLang} />
      )}

      {languages && filters.subtitleLang && (
        <Pill label={`${t("common:filterSubtitleLanguage")} · ${languageName(filters.subtitleLang, i18n.language)}`} onRemove={onClearSubtitleLang} />
      )}

      {/* Favoris et statut : la croix n'apparaît que si l'appelant sait les
          lever — elle ne faisait rien jusqu'ici. */}
      {!compact && filters.isFavorite && (
        <Pill label={t("common:favorites")} onRemove={onClearFavorite} />
      )}

      {!compact && filters.statusFilter && (
        <Pill
          label={filters.statusFilter === "IsUnplayed" ? t("common:unwatched") : t("common:inProgress")}
          onRemove={onClearStatus}
        />
      )}

      {!compact && (
        <button type="button" onClick={onReset} className="btn btn-ghost btn-sm">
          {t("library:clearAll")}
        </button>
      )}
    </div>
  );
}
