import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { MediaItem } from "@tentacle-tv/shared";
import { CollectionGridBody } from "./collection/CollectionGridBody";
import { CollectionToolbar } from "./collection/CollectionToolbar";
import type { CollectionFiltersApi } from "./collection/useCollectionFilters";
import type { SelectionMode } from "./collection/selectionMode";

export type { SelectionMode };

interface CollectionGridProps {
  title: string;
  items: MediaItem[] | undefined;
  isLoading: boolean;
  emptyMessage: string;
  emptyHint?: string;
  emptyIcon?: ReactNode;
  actions?: ReactNode;
  selectionMode?: SelectionMode;
  onFilteredIdsChange?: (ids: string[]) => void;
  /**
   * Les filtres complets — recherche, genres, années, note, tri, plateformes.
   * OPTIONNELS, et ce n'est pas une commodité : sur webOS, cette page est
   * remplacée au build par sa version téléviseur, qui appelle cette grille avec
   * son contrat d'aujourd'hui. Une prop obligatoire y casserait la
   * compilation ; absente, la grille rend ses onglets comme avant.
   */
  filters?: CollectionFiltersApi;
  /** Nom affiché dans le champ de recherche (« Rechercher dans … »). */
  searchName?: string;
  /** Faux sur la page Favoris — cf. `LibraryFilterBar`. */
  showFavorite?: boolean;
}

/**
 * Grille des collections — Ma liste et Favoris.
 *
 * En-tête, onglets de filtre et états de chargement ou de vide. Les cellules
 * vivent dans `collection/` : la carte (`CollectionGridCard`, bâtie sur
 * `PosterTile`) et le corps virtualisé (`CollectionGridBody`).
 */
export function CollectionGrid({
  title, items, isLoading, emptyMessage, emptyHint, emptyIcon, actions, selectionMode, onFilteredIdsChange,
  filters, searchName, showFavorite,
}: CollectionGridProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  // Sans filtres fournis (webOS), la liste est rendue telle quelle et les
  // identifiants remontent quand même : « tout sélectionner » continue de voir
  // la collection entière.
  const fallbackIds = useRef<string[]>([]);
  const ids = (items ?? []).map((i) => i.Id);
  if (!filters && ids.join(",") !== fallbackIds.current.join(",")) fallbackIds.current = ids;
  useEffect(() => {
    if (!filters) onFilteredIdsChange?.(fallbackIds.current);
  }, [filters, onFilteredIdsChange]);
  const filtered = filters ? filters.filtered : items;

  return (
    <div className="px-4 pt-6 md:px-8">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill-subtle text-content-secondary transition-colors hover:bg-fill-soft"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="truncate text-2xl font-bold text-content-primary">{title}</h1>
      </div>

      {filters ? (
        <CollectionToolbar
          filters={filters}
          name={searchName ?? title}
          showFavorite={showFavorite}
          actions={actions}
        />
      ) : (
        actions && <div className="mb-6 flex items-center justify-end gap-2">{actions}</div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-[2/3] rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          {filters?.isFiltered ? (
            <>
              <p className="text-lg text-content-quaternary">{t("common:noResults")}</p>
              <button
                onClick={filters.resetFilters}
                className="mt-3 text-sm font-medium text-content-tertiary underline-offset-4 transition-colors hover:text-content-primary hover:underline"
              >
                {t("common:resetFilters")}
              </button>
            </>
          ) : (
            <>
              {emptyIcon && <div className="mb-4 text-5xl opacity-40">{emptyIcon}</div>}
              <p className="text-lg text-content-quaternary">{emptyMessage}</p>
              {emptyHint && <p className="mt-2 text-sm text-content-disabled">{emptyHint}</p>}
            </>
          )}
        </div>
      ) : (
        <CollectionGridBody
          items={filtered}
          selectionMode={selectionMode}
          // La signature de l'en-tête doit bouger AVEC lui : la barre de
          // filtres change de hauteur (pastilles actives, compteur), et un
          // `scrollMargin` calé sur l'ancienne décalerait toute la grille.
          headerKey={`${filters?.queryKey ?? ""}|${filters?.type ?? "all"}|${filtered.length}|${actions ? 1 : 0}|${selectionMode?.isSelecting ? 1 : 0}`}
        />
      )}
    </div>
  );
}
