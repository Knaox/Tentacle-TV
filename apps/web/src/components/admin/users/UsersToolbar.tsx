import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { ScopedSearchField } from "../../search/ScopedSearchField";
import { USER_FILTERS, USER_SORTS, type UserFilter, type UserSort } from "./userListModel";

interface UsersToolbarProps {
  query: string;
  onQuery: (query: string) => void;
  filter: UserFilter;
  onFilter: (filter: UserFilter) => void;
  /** `null` tant que la liste n'est pas arrivée : pas de « 0 » qui clignote. */
  counts: Record<UserFilter, number> | null;
  sort: UserSort;
  onSort: (sort: UserSort) => void;
}

/**
 * Une seule rangée souple : la recherche prend la place qui reste, le filtre
 * la suit, le tri se range à droite. Chaque élément passe à la ligne SEUL
 * quand la largeur manque — un groupe « filtre + tri » qui se repliait sur
 * lui-même laissait la recherche flotter entre ses deux lignes.
 */
export function UsersToolbar({ query, onQuery, filter, onFilter, counts, sort, onSort }: UsersToolbarProps) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ScopedSearchField
        value={query}
        onChange={onQuery}
        placeholder={t("searchUsers")}
        className="min-w-[14rem] flex-1 basis-full sm:basis-0 lg:max-w-md"
      />
      <FilterGroup value={filter} counts={counts} onChange={onFilter} />
      <SortSelect value={sort} onChange={onSort} />
    </div>
  );
}

/**
 * Un groupe de boutons radio, au sens ARIA : une seule tabulation pour y
 * entrer, les flèches (et Début / Fin) pour changer de filtre — le choix suit
 * le focus, comme pour des boutons radio natifs. La peau est celle du choix
 * segmenté des réglages (`.ctl-segment`, lue sur `aria-checked`).
 */
function FilterGroup({ value, counts, onChange }: {
  value: UserFilter;
  counts: Record<UserFilter, number> | null;
  onChange: (filter: UserFilter) => void;
}) {
  const { t } = useTranslation("admin");
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const labels: Record<UserFilter, string> = {
    all: t("filterAll"),
    admins: t("usersFilterAdmins"),
    disabled: t("usersFilterDisabled"),
  };

  const select = (index: number) => {
    const next = (index + USER_FILTERS.length) % USER_FILTERS.length;
    onChange(USER_FILTERS[next]);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = USER_FILTERS.indexOf(value);
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? current + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp" ? current - 1
          : event.key === "Home" ? 0
            : event.key === "End" ? USER_FILTERS.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    select(target);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("usersFilterLabel")}
      onKeyDown={onKeyDown}
      className="inline-flex max-w-full gap-0.5 rounded-[10px] border border-line-subtle bg-tentacle-surface p-0.5"
    >
      {USER_FILTERS.map((option, index) => (
        <button
          key={option}
          ref={(element) => { refs.current[index] = element; }}
          type="button"
          role="radio"
          aria-checked={option === value}
          tabIndex={option === value ? 0 : -1}
          onClick={() => onChange(option)}
          className="ctl-segment flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {labels[option]}
          {counts && <span className="tabular-nums opacity-70">{counts[option]}</span>}
        </button>
      ))}
    </div>
  );
}

/** Un `<select>` natif : clavier, lecteurs d'écran et menus tactiles sont ceux du système. */
function SortSelect({ value, onChange }: { value: UserSort; onChange: (sort: UserSort) => void }) {
  const { t } = useTranslation("admin");
  const labels: Record<UserSort, string> = {
    name: t("usersSortName"),
    activity: t("usersSortActivity"),
    role: t("usersSortRole"),
  };
  return (
    <label className="flex items-center gap-2 sm:ml-auto">
      <span className="text-xs font-medium text-content-tertiary">{t("usersSortLabel")}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as UserSort)}
          className="h-10 cursor-pointer appearance-none rounded-[10px] border border-line-subtle bg-tentacle-surface pl-3 pr-9 text-[13px] font-medium text-content-primary outline-none transition-colors duration-150 hover:border-line-strong focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {USER_SORTS.map((option) => (
            <option key={option} value={option}>{labels[option]}</option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
      </span>
    </label>
  );
}
