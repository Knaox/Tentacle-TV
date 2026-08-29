import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import { matchesSearch } from "@tentacle-tv/shared";
import { FilterMenu } from "./FilterMenu";
import { PLATFORMS } from "../../hooks/usePlatformFilter";
import type { LibraryFilterState } from "../../hooks/useLibraryFilters";

/**
 * Chaque critère porte son sens NATUREL.
 *
 * L'ordre était jusqu'ici indépendant du critère et restait sur sa valeur
 * précédente — croissant par défaut. Choisir « derniers ajouts » listait donc
 * les plus ANCIENS, exactement l'inverse de ce que le libellé annonce ; même
 * chose pour la note, qui commençait par les plus mauvaises. Personne ne trie
 * par date d'ajout pour voir ce qui est là depuis le plus longtemps. Le bouton
 * d'inversion reste disponible juste en dessous pour les cas où l'on veut
 * précisément cela.
 */
const SORT_OPTIONS = [
  { value: "DateCreated", key: "sortDateDesc", order: "Descending" },
  { value: "SortName", key: "sortTitleAsc", order: "Ascending" },
  { value: "ProductionYear", key: "sortYear", order: "Descending" },
  { value: "CommunityRating", key: "sortRatingDesc", order: "Descending" },
] as const;

/** Ligne cochable — même gabarit dans tous les menus, d'où la factorisation. */
function CheckRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemcheckbox"
      aria-checked={checked}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
        checked ? "bg-[rgba(var(--brand-rgb),0.16)] text-[var(--brand-light)]" : "text-content-secondary hover:bg-fill-soft"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[4px] border ${
          checked ? "border-transparent bg-[var(--brand)]" : "border-line-strong"
        }`}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-cta-brand-fg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export function SortMenu({
  filters, onSortByChange, onSortOrderChange,
}: {
  filters: LibraryFilterState;
  onSortByChange: (v: string) => void;
  onSortOrderChange: (v: string) => void;
}) {
  const { t } = useTranslation("common");
  const current = SORT_OPTIONS.find((o) => o.value === filters.sortBy);
  const desc = filters.sortOrder === "Descending";

  return (
    <FilterMenu label={t("common:sortBy")} value={current ? t(`common:${current.key}`) : null}>
      <div className="flex flex-col gap-0.5" role="menu">
        {SORT_OPTIONS.map((opt) => (
          <CheckRow
            key={opt.value}
            label={t(`common:${opt.key}`)}
            checked={filters.sortBy === opt.value}
            onClick={() => { onSortByChange(opt.value); onSortOrderChange(opt.order); }}
          />
        ))}
        <div className="my-1 border-t border-line-subtle" />
        <button
          type="button"
          onClick={() => onSortOrderChange(desc ? "Ascending" : "Descending")}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-content-secondary transition-colors hover:bg-fill-soft"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={desc ? "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" : "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"} />
          </svg>
          {desc ? t("common:sortOrderDesc") : t("common:sortOrderAsc")}
        </button>
      </div>
    </FilterMenu>
  );
}

export function GenreMenu({
  libraryId, filters, onToggleGenre, onClear,
}: {
  libraryId: string;
  filters: LibraryFilterState;
  onToggleGenre: (id: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("common");
  const { data: genres } = useGenres(libraryId);
  const [query, setQuery] = useState("");

  // Une bibliothèque d'animés dépasse la centaine de genres : le mur de
  // pastilles était illisible et interminable à parcourir. Recherche d'abord.
  const shown = useMemo(() => {
    const list = genres ?? [];
    const q = query.trim();
    return q ? list.filter((g) => matchesSearch(g.Name, q)) : list;
  }, [genres, query]);

  const count = filters.genreIds.length;
  const label = count === 1
    ? (genres?.find((g) => g.Id === filters.genreIds[0])?.Name ?? t("common:genres"))
    : `${t("common:genres")} · ${count}`;

  return (
    <FilterMenu
      label={t("common:genres")}
      value={count > 0 ? label : null}
      onClear={onClear}
      width={280}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("common:genres")}
        className="mb-2 w-full rounded-md bg-fill-subtle px-2.5 py-1.5 text-xs text-content-primary placeholder-content-quaternary outline-none ring-1 ring-line-subtle focus:ring-[rgba(var(--brand-rgb),0.5)]"
      />
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto" role="menu">
        {shown.map((g) => (
          <CheckRow
            key={g.Id}
            label={g.Name}
            checked={filters.genreIds.includes(g.Id)}
            onClick={() => onToggleGenre(g.Id)}
          />
        ))}
        {shown.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-content-quaternary">{t("common:noResults")}</p>
        )}
      </div>
    </FilterMenu>
  );
}

export function YearMenu({
  filters, onYearFromChange, onYearToChange, onClear,
}: {
  filters: LibraryFilterState;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("common");
  const parse = (v: string): number | null => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };
  const { yearFrom, yearTo } = filters;
  const value = yearFrom || yearTo ? `${yearFrom ?? "…"} — ${yearTo ?? "…"}` : null;
  const inputCls =
    "w-full rounded-md bg-fill-subtle px-2.5 py-1.5 text-xs text-content-primary placeholder-content-quaternary outline-none ring-1 ring-line-subtle focus:ring-[rgba(var(--brand-rgb),0.5)]";

  return (
    <FilterMenu label={t("common:sortYear")} value={value} onClear={onClear} width={230}>
      <div className="flex items-center gap-2">
        <input type="number" min={1900} max={2100} placeholder={t("common:yearFrom")} value={yearFrom ?? ""} onChange={(e) => onYearFromChange(parse(e.target.value))} className={inputCls} />
        <span className="text-xs text-content-quaternary">—</span>
        <input type="number" min={1900} max={2100} placeholder={t("common:yearTo")} value={yearTo ?? ""} onChange={(e) => onYearToChange(parse(e.target.value))} className={inputCls} />
      </div>
    </FilterMenu>
  );
}

export function RatingMenu({
  filters, onRatingMinChange, onClear,
}: {
  filters: LibraryFilterState;
  onRatingMinChange: (v: number | null) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("common");
  const current = filters.ratingMin ?? 0;

  return (
    <FilterMenu
      label={t("common:ratingMin")}
      value={current > 0 ? `★ ${current.toFixed(1)}+` : null}
      onClear={onClear}
      width={230}
    >
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-content-quaternary">{t("common:ratingMin")}</span>
        <span className="font-medium text-content-secondary">
          {current > 0 ? `${current.toFixed(1)}+` : t("common:ratingAny")}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={current}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onRatingMinChange(v > 0 ? v : null);
        }}
        className="w-full accent-[var(--brand)]"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-content-disabled">
        <span>0</span><span>5</span><span>10</span>
      </div>
    </FilterMenu>
  );
}

export function PlatformMenu({
  filters, onTogglePlatform, onClear,
}: {
  filters: LibraryFilterState;
  onTogglePlatform: (id: number) => void;
  onClear: () => void;
}) {
  const count = filters.platformIds.length;
  const label = count === 1
    ? (PLATFORMS.find((p) => p.id === filters.platformIds[0])?.name ?? "Plateformes")
    : `Plateformes · ${count}`;

  return (
    <FilterMenu label="Plateformes" value={count > 0 ? label : null} onClear={onClear} width={240}>
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto" role="menu">
        {PLATFORMS.map((p) => (
          <CheckRow
            key={p.id}
            label={p.name}
            checked={filters.platformIds.includes(p.id)}
            onClick={() => onTogglePlatform(p.id)}
          />
        ))}
      </div>
    </FilterMenu>
  );
}
