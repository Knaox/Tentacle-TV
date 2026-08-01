import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { MediaItem } from "@tentacle-tv/shared";
import { CollectionGridBody } from "./collection/CollectionGridBody";
import { useCollectionFilter } from "./collection/useCollectionFilter";
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
}: CollectionGridProps) {
  const navigate = useNavigate();
  const { filter, setFilter, filtered, tabs } = useCollectionFilter(items, onFilteredIdsChange);

  return (
    <div className="px-4 pt-6 md:px-12">
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

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              filter === tab.key
                ? "bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.3)]"
                : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-[2/3] rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          {emptyIcon && <div className="mb-4 text-5xl opacity-40">{emptyIcon}</div>}
          <p className="text-lg text-content-quaternary">{emptyMessage}</p>
          {emptyHint && <p className="mt-2 text-sm text-content-disabled">{emptyHint}</p>}
        </div>
      ) : (
        <CollectionGridBody
          items={filtered}
          selectionMode={selectionMode}
          headerKey={`${filter}|${filtered.length}|${actions ? 1 : 0}|${selectionMode?.isSelecting ? 1 : 0}`}
        />
      )}
    </div>
  );
}
