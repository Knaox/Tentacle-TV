import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ChevronDown, Heart } from "lucide-react";
import { CompactSegmented } from "../screens/settings/ui/SettingsChoiceRow";
import { SORT_OPTIONS } from "./catalogOptions";
import type { LibraryCatalogState } from "./useLibraryCatalogState";

const ALL = "all";

/**
 * La barre rapide d'un catalogue (`components/library/LibraryQuickBar` de
 * l'app) : le statut de visionnage en segmenté compact, les favoris, et le tri
 * en cours qui ouvre « Trier et filtrer ». Une rangée qui défile à
 * l'horizontale, jamais sur deux lignes ; marges 16, écart 8, pastilles 36.
 */
export const LibraryQuickBar = memo(function LibraryQuickBar({ state }: { state: LibraryCatalogState }) {
  const { t } = useTranslation(["common", "library"]);
  const sort = SORT_OPTIONS[state.sortIndex];
  const favorite = state.advancedFilters.isFavorite;
  const SortIcon = sort.sortOrder === "Descending" ? ArrowDown : ArrowUp;

  return (
    <div className="mirror-no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-3 pt-1">
      <CompactSegmented
        label={t("library:watchStatus")}
        value={state.statusFilter ?? ALL}
        onChange={(v) => state.setStatusFilter(v === ALL ? null : v)}
        options={[
          { value: ALL, label: t("common:allFilter") },
          { value: "IsUnplayed", label: t("common:unwatched") },
          { value: "IsResumable", label: t("common:inProgress") },
        ]}
      />
      <button
        type="button"
        onClick={() => state.advanced.onFavoriteChange(!favorite)}
        aria-pressed={favorite}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-transform duration-100 active:scale-[0.97] active:opacity-80"
        style={{
          background: favorite ? "rgba(var(--brand-accent-rgb), 0.16)" : "var(--surface-1)",
          borderColor: favorite ? "var(--brand-accent)" : "var(--border-strong)",
        }}
      >
        <Heart size={14} aria-hidden className={favorite ? "text-[var(--brand-accent-light)]" : "text-content-secondary"} />
        <span className={`text-[13px] font-semibold ${favorite ? "text-[var(--brand-accent-light)]" : "text-content-secondary"}`}>
          {t("common:favorites")}
        </span>
      </button>
      <button
        type="button"
        onClick={() => state.setSheetOpen(true)}
        aria-label={t("library:sortedBy", { sort: t(`common:${sort.labelKey}`) })}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface-1 px-3 transition-transform duration-100 active:scale-[0.97] active:opacity-80"
      >
        <SortIcon size={14} aria-hidden className="text-brand-light" />
        <span className="whitespace-nowrap text-[13px] font-semibold text-content-secondary">{t(`common:${sort.labelKey}`)}</span>
        <ChevronDown size={14} aria-hidden className="text-content-tertiary" />
      </button>
    </div>
  );
});
