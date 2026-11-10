import { useTranslation } from "react-i18next";
import type { InviteFilter } from "./inviteFormat";

const FILTERS: readonly InviteFilter[] = ["all", "active", "expired", "exhausted"];

interface InviteFiltersProps {
  value: InviteFilter;
  counts: Record<InviteFilter, number>;
  onChange: (filter: InviteFilter) => void;
}

/** Toutes, actives, expirées, épuisées — chacune avec son compte. */
export function InviteFilters({ value, counts, onChange }: InviteFiltersProps) {
  const { t } = useTranslation("adminInvites");
  return (
    <div role="group" aria-label={t("filtersLabel")} className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const selected = filter === value;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(filter)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none transition-[color,background-color,transform] duration-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus ${
              selected
                ? "bg-surface-4 text-content-primary"
                : "bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
            }`}
          >
            {t(`filter_${filter}`)}
            <span className="num text-content-tertiary">{counts[filter]}</span>
          </button>
        );
      })}
    </div>
  );
}
