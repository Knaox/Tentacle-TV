import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import {
  ActiveFilterChips,
  COLLECTION_SORTS,
  DEFAULT_COLLECTION_SORT,
  FilterButton,
  STATUS_OPTIONS,
  ScopedSearchField,
  type ActiveChip,
} from "../../catalog";
import { CollectionFilterSheet } from "./CollectionFilterSheet";
import type { CollectionFiltersApi } from "./useCollectionFilters";

/**
 * La barre de filtres de Ma liste et Mes favoris (`collection/CollectionFilterHeader`
 * de l'app) : UNE rangée — le type (Tous, Films, Séries) en segments de 36
 * dans une pilule `fill.subtle`, la loupe et « Trier et filtrer » en ronds de
 * 44. La recherche se révèle d'un toucher à la place de la rangée. Ce qui
 * filtre est rappelé dessous en pastilles qu'on retire, s'il y en a.
 */
export const CollectionFilterHeader = memo(function CollectionFilterHeader({ filters }: { filters: CollectionFiltersApi }) {
  const { t } = useTranslation("common");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { state, patch } = filters;

  const sort = COLLECTION_SORTS.find((s) => s.sortBy === state.sortBy);
  const status = STATUS_OPTIONS.find((o) => o.value !== null && o.value === state.statusFilter);
  const chips: ActiveChip[] = [
    ...(sort && sort.sortBy !== DEFAULT_COLLECTION_SORT.sortBy
      ? [{
          key: "sort",
          label: t(sort.key),
          remove: () => patch({ sortBy: DEFAULT_COLLECTION_SORT.sortBy, sortOrder: DEFAULT_COLLECTION_SORT.sortOrder }),
        }]
      : []),
    ...(status ? [{ key: "status", label: t(status.labelKey), remove: () => patch({ statusFilter: null }) }] : []),
    ...state.genres.map((id) => ({
      key: `g-${id}`,
      label: filters.genres.find((g) => g.Id === id)?.Name ?? id,
      remove: () => patch({ genres: state.genres.filter((g) => g !== id) }),
    })),
  ];

  return (
    <div className="flex flex-col gap-2 pb-2">
      {searchOpen ? (
        <ScopedSearchField
          value={filters.input}
          onChange={filters.setInput}
          placeholder={t("searchInLibrary", { name: "" }).trim()}
          count={state.search.length >= 2 ? filters.resultCount : null}
          onClear={() => {
            filters.setInput("");
            setSearchOpen(false);
          }}
          autoFocus
        />
      ) : (
        <div className="flex items-center gap-2 px-4">
          <div role="tablist" className="flex flex-1 gap-1 rounded-full bg-fill-subtle p-1">
            {filters.tabs.map((tab) => {
              const selected = state.type === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => patch({ type: tab.key })}
                  className={`flex min-h-[36px] flex-1 items-center justify-center rounded-full px-2 text-sm ${
                    selected ? "font-semibold text-brand-light" : "font-medium text-content-tertiary"
                  }`}
                  style={selected ? { background: "rgba(var(--brand-rgb), 0.22)" } : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t("search")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill-subtle text-content-secondary"
          >
            <Search size={19} aria-hidden />
          </button>
          <FilterButton count={filters.activeCount} onPress={() => setSheetOpen(true)} label={t("sortAndFilter")} variant="soft" />
        </div>
      )}

      <ActiveFilterChips chips={chips} onReset={filters.reset} />
      <CollectionFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} filters={filters} />
    </div>
  );
});
