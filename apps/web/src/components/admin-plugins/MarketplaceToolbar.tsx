import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScopedSearchField } from "../search/ScopedSearchField";
import { humanizeSlug } from "./pluginCatalog";

export interface CatalogFilter {
  query: string;
  category: string | null;
}

/** Le libellé d'une catégorie : traduit s'il est connu, sinon l'identifiant rendu lisible. */
export function useCategoryLabel() {
  const { t } = useTranslation("adminPlugins");
  return useCallback((id: string) => t(`categories.${id}`, { defaultValue: humanizeSlug(id) }), [t]);
}

interface MarketplaceToolbarProps {
  filter: CatalogFilter;
  onFilter: (filter: CatalogFilter) => void;
  categories: { id: string; count: number }[];
  total: number;
  shown: number;
}

/**
 * Chercher et filtrer le catalogue : le champ de recherche des pages (accents,
 * casse et ponctuation ignorés), une puce par catégorie publiée, et le nombre
 * de plugins affichés — annoncé aux lecteurs d'écran quand il change.
 */
export function MarketplaceToolbar({ filter, onFilter, categories, total, shown }: MarketplaceToolbarProps) {
  const { t } = useTranslation("adminPlugins");
  const label = useCategoryLabel();
  const chips = [{ id: null, label: t("allCategories"), count: total }, ...categories.map((c) => ({ id: c.id, label: label(c.id), count: c.count }))];

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-3">
        <ScopedSearchField
          value={filter.query}
          onChange={(query) => onFilter({ ...filter, query })}
          placeholder={t("searchPlaceholder")}
          className="max-w-md"
        />
        <p aria-live="polite" className="ml-auto shrink-0 whitespace-nowrap text-xs tabular-nums text-content-tertiary">
          {t("resultCount", { count: shown })}
        </p>
      </div>
      {categories.length > 0 && (
        <div role="group" aria-label={t("categoriesLabel")} className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = filter.category === chip.id;
            return (
              <button
                key={chip.id ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => onFilter({ ...filter, category: active && chip.id ? null : chip.id })}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-line-focus ${
                  active
                    ? "border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)] text-content-primary"
                    : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
                }`}
              >
                {chip.label}
                <span className="tabular-nums text-content-quaternary">{chip.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
