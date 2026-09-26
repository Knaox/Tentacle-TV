import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchResponse } from "@tentacle-tv/shared";

export type SearchFilter = "all" | "movies" | "series" | "collections" | "people" | "episodes";

export interface FilterOption {
  key: SearchFilter;
  /** `null` : le compte n'est pas connu (épisodes, demandés à part). */
  count: number | null;
}

/** Les filtres qui ont quelque chose à montrer — « Tout » d'abord, toujours. */
export function availableFilters(response: SearchResponse | undefined, episodeCount: number): FilterOption[] {
  const options: FilterOption[] = [{ key: "all", count: null }];
  if (!response) return options;
  const { totals } = response;
  if (totals.movies > 0) options.push({ key: "movies", count: totals.movies });
  if (totals.series > 0) options.push({ key: "series", count: totals.series });
  if (totals.collections > 0) options.push({ key: "collections", count: totals.collections });
  if (totals.people > 0) options.push({ key: "people", count: totals.people });
  if (episodeCount > 0) options.push({ key: "episodes", count: null });
  return options;
}

/**
 * `SearchFilters` de l'app : les pastilles sous le champ, en ligne qui défile.
 * Pastille 36 de haut, 14 de marge, rayon plein, filet `border.subtle` sur
 * `fill.subtle` ; active : `brand.soft` bordé de `brand.glow`, libellé violet
 * clair. Libellé 13 semi-gras, compte 12. Un seul filtre (« Tout ») : rien.
 */
export const SearchFilters = memo(function SearchFilters({ options, active, onChange }: {
  options: FilterOption[];
  active: SearchFilter;
  onChange: (filter: SearchFilter) => void;
}) {
  const { t } = useTranslation("search");
  if (options.length <= 1) return null;
  return (
    <div role="tablist" className="mirror-no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2">
      {options.map(({ key, count }) => {
        const selected = key === active;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 ${
              selected ? "" : "border-line-subtle bg-fill-subtle active:opacity-75"
            }`}
            style={selected ? { background: "var(--brand-soft)", borderColor: "var(--brand-glow)" } : undefined}
          >
            <span className={`text-[13px] font-semibold ${selected ? "text-brand-light" : "text-content-secondary"}`}>{t(key)}</span>
            {count !== null && (
              <span className={`text-xs font-medium ${selected ? "text-brand-light" : "text-content-tertiary"}`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
});
