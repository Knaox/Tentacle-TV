import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowsDownUpIcon as ArrowUpDown } from "@phosphor-icons/react/dist/csr/ArrowsDownUp";
import { ArrowDownIcon } from "@phosphor-icons/react/dist/csr/ArrowDown";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/csr/ArrowUp";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { matchesSearch } from "@tentacle-tv/shared";
import { FilterMenu } from "./FilterMenu";
import { PLATFORMS } from "../../hooks/usePlatformFilter";
import type { LibraryFilterState } from "../../hooks/useLibraryFilters";
import { rangeFill } from "../../lib/rangeFill";

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

/**
 * Ligne cochable — même gabarit dans tous les menus, d'où la factorisation : l'entrée de menu
 * du socle (`.ui-menu-item`), et sa marque.
 *
 * `mark="box"` (défaut) : une case, pour ce qui se cumule (genres, plateformes). `mark="check"` :
 * une coche seule à l'accent, pour un choix unique (tri, langue) — une case y promettait un
 * cumul qui n'existe pas. Le rôle reste `menuitemcheckbox` dans les deux cas : la cible webOS
 * y résout l'entrée du menu.
 */
export function CheckRow({ label, checked, onClick, mark = "box" }: {
  label: string;
  checked: boolean;
  onClick: () => void;
  mark?: "box" | "check";
}) {
  return (
    // `title` : un libellé long (un genre importé, une plateforme) est coupé d'une ellipse — il se lit en entier au survol.
    <button type="button" onClick={onClick} role="menuitemcheckbox" aria-checked={checked} title={label} className="ui-menu-item">
      {mark === "box" ? (
        <span className="lg-check ui-check">
          <CheckIcon size={13} weight="bold" aria-hidden />
        </span>
      ) : (
        <span className="flex w-4 flex-shrink-0 justify-center text-accent">
          {checked && <CheckIcon size={15} weight="bold" aria-hidden />}
        </span>
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Le champ d'un menu de filtre : le champ du socle, à la hauteur d'une entrée. */
const MENU_FIELD = "field h-9 w-full text-sm";

export function SortMenu({
  filters, onSortByChange, onSortOrderChange, toolbar = false,
}: {
  filters: LibraryFilterState;
  onSortByChange: (v: string) => void;
  onSortOrderChange: (v: string) => void;
  /** En fin de barre d'outils : icône, ton neutre, panneau ancré à droite. */
  toolbar?: boolean;
}) {
  const { t } = useTranslation("common");
  const current = SORT_OPTIONS.find((o) => o.value === filters.sortBy);
  const desc = filters.sortOrder === "Descending";

  return (
    <FilterMenu
      label={t("common:sortBy")}
      value={current ? t(`common:${current.key}`) : null}
      neutral={toolbar}
      align={toolbar ? "right" : "left"}
      icon={toolbar ? <ArrowUpDown aria-hidden className="h-3.5 w-3.5" /> : undefined}
    >
      <div className="flex flex-col" role="menu">
        {SORT_OPTIONS.map((opt) => (
          <CheckRow
            key={opt.value}
            mark="check"
            label={t(`common:${opt.key}`)}
            checked={filters.sortBy === opt.value}
            onClick={() => { onSortByChange(opt.value); onSortOrderChange(opt.order); }}
          />
        ))}
        <div className="lg-sep ui-menu-separator" />
        <button type="button" onClick={() => onSortOrderChange(desc ? "Ascending" : "Descending")} className="lg-row ui-menu-item">
          <span className="flex w-4 flex-shrink-0 justify-center">
            {desc ? <ArrowDownIcon size={15} aria-hidden /> : <ArrowUpIcon size={15} aria-hidden />}
          </span>
          {desc ? t("common:sortOrderDesc") : t("common:sortOrderAsc")}
        </button>
      </div>
    </FilterMenu>
  );
}

export function GenreMenu({
  genres, filters, onToggleGenre, onClear,
}: {
  /**
   * La liste des genres, FOURNIE — ce menu ne la cherche plus lui-même.
   * `useGenres` exige un `ParentId`, que Ma liste et Mes favoris n'ont pas :
   * ces pages dérivent leurs genres des titres déjà chargés. Obligatoire, et
   * pas optionnelle : un appelant l'oublierait, et le menu serait vide sans
   * que rien ne le dise.
   */
  genres: Array<{ Id: string; Name: string }>;
  filters: LibraryFilterState;
  onToggleGenre: (id: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");

  // Une bibliothèque d'animés dépasse la centaine de genres : le mur de
  // pastilles était illisible et interminable à parcourir. Recherche d'abord.
  const shown = useMemo(() => {
    const list = genres;
    const q = query.trim();
    return q ? list.filter((g) => matchesSearch(g.Name, q)) : list;
  }, [genres, query]);

  const count = filters.genreIds.length;
  const label = count === 1
    ? (genres.find((g) => g.Id === filters.genreIds[0])?.Name ?? t("common:genres"))
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
        aria-label={t("common:genres")}
        className={`${MENU_FIELD} mb-1.5`}
      />
      <div className="flex max-h-72 flex-col overflow-y-auto" role="menu">
        {shown.map((g) => (
          <CheckRow
            key={g.Id}
            label={g.Name}
            checked={filters.genreIds.includes(g.Id)}
            onClick={() => onToggleGenre(g.Id)}
          />
        ))}
        {shown.length === 0 && (
          <p className="px-2.5 py-3 text-center text-sm text-content-tertiary">{t("common:noResults")}</p>
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
  return (
    <FilterMenu label={t("common:sortYear")} value={value} onClear={onClear} width={250}>
      <div className="flex items-center gap-2 p-1">
        <input type="number" min={1900} max={2100} placeholder={t("common:yearFrom")} aria-label={t("common:yearFrom")} value={yearFrom ?? ""} onChange={(e) => onYearFromChange(parse(e.target.value))} className={`${MENU_FIELD} tabular-nums`} />
        <span className="text-sm text-content-quaternary" aria-hidden>—</span>
        <input type="number" min={1900} max={2100} placeholder={t("common:yearTo")} aria-label={t("common:yearTo")} value={yearTo ?? ""} onChange={(e) => onYearToChange(parse(e.target.value))} className={`${MENU_FIELD} tabular-nums`} />
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
      width={250}
    >
      <div className="flex flex-col gap-2 px-2.5 pb-2 pt-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-content-tertiary">{t("common:ratingMin")}</span>
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-content-primary">
            {current > 0 && <StarIcon size={13} weight="fill" aria-hidden />}
            {current > 0 ? `${current.toFixed(1)}+` : t("common:ratingAny")}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={current}
          aria-label={t("common:ratingMin")}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onRatingMinChange(v > 0 ? v : null);
          }}
          style={rangeFill(current, 0, 10)}
          className="ctl-range w-full"
        />
        <div className="flex justify-between text-[11px] tabular-nums text-content-quaternary" aria-hidden>
          <span>0</span><span>5</span><span>10</span>
        </div>
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
  const { t } = useTranslation("common");
  const count = filters.platformIds.length;
  const label = count === 1
    ? (PLATFORMS.find((p) => p.id === filters.platformIds[0])?.name ?? t("common:platforms"))
    : `${t("common:platforms")} · ${count}`;

  return (
    <FilterMenu label={t("common:platforms")} value={count > 0 ? label : null} onClear={onClear} width={240}>
      <div className="flex max-h-72 flex-col overflow-y-auto" role="menu">
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
