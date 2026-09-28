import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import {
  ActiveFilterChips,
  COLLECTION_SORTS,
  DEFAULT_COLLECTION_SORT,
  FilterButton,
  STATUS_OPTIONS,
  ScopedSearchField,
  type ActiveChip,
} from "../../catalog";
import { CompactSegmented } from "../settings/ui/SettingsChoiceRow";
import { CollectionFilterSheet } from "./CollectionFilterSheet";
import type { CollectionFiltersApi } from "./useCollectionFilters";

/**
 * La pastille de la barre rapide (`LibraryQuickBar`) : 36 de haut, aplat
 * `surface.s1`, liseré `border.strong`, texte 13 semi-gras ; choisie, aplat
 * `brand.soft` et liseré `brand.glow`. Ma liste et Mes favoris la reprennent
 * pour leurs propres réglages (grille ou liste, regroupement).
 */
export function QuickChip({ active = false, onClick, label, children, pressed }: {
  active?: boolean;
  onClick: () => void;
  /** Étiquette accessible, quand le contenu n'est qu'une icône. */
  label?: string;
  /** `aria-pressed` pour une bascule, `aria-checked` sinon (dans un radiogroup). */
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-transform duration-100 active:scale-[0.97] active:opacity-80 ${
        active ? "text-brand-light" : "text-content-secondary"
      }`}
      style={{
        background: active ? "var(--brand-soft)" : "var(--surface-1)",
        borderColor: active ? "var(--brand-glow)" : "var(--border-strong)",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Recherche et filtres de Ma liste et Mes favoris, À LA FORME de la
 * Bibliothèque (`LibraryCatalogView`) : le champ toujours visible et, à côté,
 * « Trier et filtrer » avec son nombre ; `lead` (les étapes de Ma liste) ;
 * puis la barre rapide qui défile d'un doigt — le type en segmenté compact, le
 * tri en cours (qui ouvre la feuille) et `quick` au bout ; enfin, ce qui
 * filtre, en pastilles qu'on retire.
 */
export const CollectionControls = memo(function CollectionControls({ filters, name, lead, quick }: {
  filters: CollectionFiltersApi;
  /** Nom de la collection, pour l'invite du champ. */
  name: string;
  lead?: ReactNode;
  quick?: ReactNode;
}) {
  const { t } = useTranslation(["common", "library", "watchlist"]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { state, patch } = filters;

  const sort = COLLECTION_SORTS.find((s) => s.sortBy === state.sortBy) ?? DEFAULT_COLLECTION_SORT;
  const SortIcon = state.sortOrder === "Ascending" ? ArrowUp : ArrowDown;
  const status = STATUS_OPTIONS.find((o) => o.value !== null && o.value === state.statusFilter);
  // Le tri a sa pastille dans la barre rapide : on ne le répète pas ici.
  const chips: ActiveChip[] = [
    ...(status ? [{ key: "status", label: t(`common:${status.labelKey}`), remove: () => patch({ statusFilter: null }) }] : []),
    ...state.genres.map((id) => ({
      key: `g-${id}`,
      label: filters.genres.find((g) => g.Id === id)?.Name ?? id,
      remove: () => patch({ genres: state.genres.filter((g) => g !== id) }),
    })),
  ];

  return (
    <div className="flex flex-col">
      <div className="mb-1 mt-3 flex items-center gap-2 px-4">
        <ScopedSearchField
          value={filters.input}
          onChange={filters.setInput}
          placeholder={t("common:searchInLibrary", { name })}
          count={state.search.length >= 2 ? filters.resultCount : null}
          inset={false}
        />
        <FilterButton count={filters.activeCount} onPress={() => setSheetOpen(true)} label={t("common:sortAndFilter")} />
      </div>
      {lead}
      <div className="mirror-no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-3 pt-1">
        <CompactSegmented
          label={t("watchlist:typeFilterLabel")}
          value={state.type}
          onChange={(type) => patch({ type: type as typeof state.type })}
          options={filters.tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
        />
        <QuickChip onClick={() => setSheetOpen(true)} label={t("library:sortedBy", { sort: t(`common:${sort.key}`) })}>
          <SortIcon size={14} aria-hidden className="text-brand-light" />
          {t(`common:${sort.key}`)}
          <ChevronDown size={14} aria-hidden className="text-content-tertiary" />
        </QuickChip>
        {quick}
      </div>
      <ActiveFilterChips chips={chips} onReset={filters.reset} className="pb-3" />
      <CollectionFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} filters={filters} />
    </div>
  );
});
