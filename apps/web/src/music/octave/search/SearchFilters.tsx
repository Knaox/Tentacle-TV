/**
 * Octave — les puces de filtre d'une recherche : Tout · Titres · Albums · Artistes · Playlists. Un groupe d'onglets
 * (flèches gauche / droite, Début / Fin) ; la puce choisie vit dans l'adresse (`?f=`), comme la requête.
 * Rien ne bouge en changeant de puce : seule la liste au-dessous change.
 */

import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SearchFilter } from "./searchLayout";

export const SEARCH_FILTERS: readonly SearchFilter[] = ["all", "tracks", "albums", "artists", "playlists"];

export function parseSearchFilter(raw: string | null): SearchFilter {
  return SEARCH_FILTERS.includes(raw as SearchFilter) ? (raw as SearchFilter) : "all";
}

interface SearchFiltersProps {
  value: SearchFilter;
  onChange: (filter: SearchFilter) => void;
  /** L'identifiant du panneau que les puces commandent (`aria-controls`). */
  panelId: string;
}

export const SearchFilters = memo(function SearchFilters({ value, onChange, panelId }: SearchFiltersProps) {
  const { t } = useTranslation("music");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const label = (f: SearchFilter) => (f === "all" ? t("search.filterAll") : t(`search.${f}`));
  const move = (index: number) => {
    const next = (index + SEARCH_FILTERS.length) % SEARCH_FILTERS.length;
    refs.current[next]?.focus();
    onChange(SEARCH_FILTERS[next]);
  };

  return (
    <div role="tablist" aria-label={t("search.filters")} className="flex flex-wrap gap-2 px-2">
      {SEARCH_FILTERS.map((filter, index) => {
        const selected = filter === value;
        return (
          <button
            key={filter}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${panelId}-${filter}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(filter)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(index + 1);
              else if (e.key === "ArrowLeft") move(index - 1);
              else if (e.key === "Home") move(0);
              else if (e.key === "End") move(SEARCH_FILTERS.length - 1);
              else return;
              e.preventDefault();
            }}
            className={`octave-pill h-9 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              selected ? "bg-content-primary text-surface-0" : "bg-fill-subtle text-content-secondary hover:bg-fill-medium hover:text-content-primary"
            }`}
          >
            {label(filter)}
          </button>
        );
      })}
    </div>
  );
});
