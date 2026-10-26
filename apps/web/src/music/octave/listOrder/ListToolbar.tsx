/**
 * Octave — la barre d'une playlist ou des titres likés : chercher dans la
 * liste, filtrer (seulement les puces qui ont un sens pour elle), trier. Une
 * ligne qui garde sa hauteur ; sur une fenêtre étroite, les puces passent
 * dessous. Pendant une recherche ou un filtre, le compte dit ce qui reste.
 */

import { memo, useRef } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicListDirection, MusicListPrefs, MusicListSortKey } from "@tentacle-tv/shared/music";
import type { ListFilter } from "./listView";
import { SortMenu } from "./SortMenu";

interface ListToolbarProps {
  query: string;
  onQuery: (query: string) => void;
  filter: ListFilter;
  filters: readonly ListFilter[];
  onFilter: (filter: ListFilter) => void;
  prefs: MusicListPrefs;
  sorts?: readonly MusicListSortKey[];
  onSort: (sort: MusicListSortKey, direction: MusicListDirection) => void;
  /** Rangées montrées / au total (le compte ne paraît que si elles diffèrent). */
  shown: number;
  total: number;
}

export const ListToolbar = memo(function ListToolbar({ query, onQuery, filter, filters, onFilter, prefs, sorts, onSort, shown, total }: ListToolbarProps) {
  const { t } = useTranslation("music");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div role="toolbar" aria-label={t("listOrder.toolbar")} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 pb-3">
      <label className="relative flex h-9 w-full min-w-0 items-center sm:w-72">
        <span className="sr-only">{t("listOrder.searchLabel")}</span>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-content-tertiary" aria-hidden />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.stopPropagation();
              onQuery("");
            }
          }}
          placeholder={t("listOrder.searchPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-full rounded-full border border-transparent bg-fill-subtle pl-9 pr-9 text-sm text-content-primary placeholder:text-content-tertiary transition-colors duration-150 hover:bg-fill-medium focus:border-line-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQuery("");
              input.current?.focus();
            }}
            aria-label={t("listOrder.clearSearch")}
            className="absolute right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </label>
      {filters.length > 1 && (
        <div role="radiogroup" aria-label={t("listOrder.filters")} className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={f === filter}
              onClick={() => onFilter(f)}
              className={`octave-pill h-8 cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                f === filter ? "bg-content-primary text-surface-0" : "bg-fill-subtle text-content-secondary hover:bg-fill-medium hover:text-content-primary"
              }`}
            >
              {t(`listOrder.filter.${f}`)}
            </button>
          ))}
        </div>
      )}
      <div className="ml-auto flex items-center gap-3">
        {shown !== total && (
          <span className="oc-meta text-[13px] tabular-nums text-content-tertiary" aria-live="polite">
            {t("listOrder.count", { count: shown, total })}
          </span>
        )}
        <SortMenu prefs={prefs} sorts={sorts} onSort={onSort} />
      </div>
    </div>
  );
});
