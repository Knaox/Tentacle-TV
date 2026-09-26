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
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.4)] ${
              selected
                ? "border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)] text-content-primary"
                : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
            }`}
          >
            {t(`filter_${filter}`)}
            <span className="tabular-nums text-content-quaternary">{counts[filter]}</span>
          </button>
        );
      })}
    </div>
  );
}
