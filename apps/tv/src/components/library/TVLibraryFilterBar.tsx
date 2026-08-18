import { useRef } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import type { MenuAnchor } from "./TVLibraryFilterMenu";
import type { LibraryFilterState } from "../../hooks/useLibraryFilters";
import { PLATFORMS } from "../../hooks/usePlatformFilter";
import { SORT_OPTIONS } from "./TVLibrarySortGenreMenus";
import { Colors, Radius } from "../../theme/colors";

export type FilterMenuKind = "sort" | "genres" | "years" | "rating" | "platforms";

const STATUS_QUICK = [
  { value: null, key: "allFilter" },
  { value: "IsUnplayed", key: "unwatched" },
  { value: "IsResumable", key: "inProgress" },
] as const;

interface TVLibraryFilterBarProps {
  filters: LibraryFilterState;
  hasActiveFilters: boolean;
  totalResults: number | undefined;
  onStatusChange: (v: string | null) => void;
  onFavoriteChange: (v: boolean) => void;
  onOpenMenu: (kind: FilterMenuKind, anchor: MenuAnchor) => void;
  onReset: () => void;
}

/**
 * La barre de filtres — parité `LibraryFilterBar` (web/webOS) : les statuts en
 * pastilles (exclusifs du filtre Favoris), puis UN déclencheur de menu par
 * critère (tri, genres, années, note, plateformes), le compteur de résultats
 * et « Réinitialiser les filtres ». Chaque menu s'ancre sous sa pastille — la
 * position est mesurée à l'ouverture (`measureInWindow`).
 */
export function TVLibraryFilterBar({
  filters,
  hasActiveFilters,
  totalResults,
  onStatusChange,
  onFavoriteChange,
  onOpenMenu,
  onReset,
}: TVLibraryFilterBarProps) {
  const { t } = useTranslation("common");

  const sortLabel = t(SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.key ?? "sortBy");
  const genreValue = filters.genreIds.length > 0 ? ` · ${filters.genreIds.length}` : "";
  const yearValue = filters.yearFrom != null || filters.yearTo != null
    ? ` · ${filters.yearFrom ?? "…"}-${filters.yearTo ?? "…"}`
    : "";
  const ratingValue = filters.ratingMin != null ? ` · ★ ${filters.ratingMin.toFixed(1)}+` : "";
  const platformValue = filters.platformIds.length === 1
    ? ` · ${PLATFORMS.find((p) => p.id === filters.platformIds[0])?.name ?? ""}`
    : filters.platformIds.length > 1
      ? ` · ${filters.platformIds.length}`
      : "";

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 20 }}>
      {STATUS_QUICK.map((opt) => (
        <FilterChip
          key={opt.key}
          label={t(opt.key)}
          active={filters.statusFilter === opt.value && !filters.isFavorite}
          onPress={() => onStatusChange(opt.value)}
        />
      ))}
      <FilterChip
        label={t("favorites")}
        active={filters.isFavorite}
        accent="rose"
        onPress={() => onFavoriteChange(!filters.isFavorite)}
      />

      <MenuChip label={`${t("sortBy")} · ${sortLabel}`} active={false} kind="sort" onOpenMenu={onOpenMenu} />
      <MenuChip label={`${t("genres")}${genreValue}`} active={filters.genreIds.length > 0} kind="genres" onOpenMenu={onOpenMenu} />
      <MenuChip label={`${t("sortYear")}${yearValue}`} active={filters.yearFrom != null || filters.yearTo != null} kind="years" onOpenMenu={onOpenMenu} />
      <MenuChip label={`${t("ratingMin")}${ratingValue}`} active={filters.ratingMin != null} kind="rating" onOpenMenu={onOpenMenu} />
      <MenuChip label={`${t("platforms")}${platformValue}`} active={filters.platformIds.length > 0} kind="platforms" onOpenMenu={onOpenMenu} />

      {hasActiveFilters && (
        <FilterChip label={t("resetFilters")} active={false} onPress={onReset} />
      )}

      {totalResults != null && (
        <Text style={{ color: Colors.textMuted, fontSize: 14, marginLeft: 6 }}>
          {t("resultCount", { count: totalResults })}
        </Text>
      )}
    </View>
  );
}

/** Une pastille — état actif en teinte de marque (violet, ou rose pour les
 *  favoris), comme les chips de la barre web. */
function FilterChip({
  label,
  active,
  accent = "violet",
  onPress,
}: {
  label: string;
  active: boolean;
  accent?: "violet" | "rose";
  onPress: () => void;
}) {
  const activeBg = accent === "rose" ? "rgba(244, 114, 182, 0.22)" : "rgba(139, 92, 246, 0.24)";
  const activeBorder = accent === "rose" ? "rgba(244, 114, 182, 0.55)" : "rgba(139, 92, 246, 0.6)";
  const activeText = accent === "rose" ? Colors.accentPink : Colors.accentPurpleLight;

  return (
    <Focusable variant="button" focusRadius={Radius.pill} onPress={onPress} accessibilityLabel={label}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: Radius.pill,
          backgroundColor: active ? activeBg : Colors.ctaGhostBg,
          borderWidth: 1,
          borderColor: active ? activeBorder : Colors.glassBorder,
        }}
      >
        <Text style={{ color: active ? activeText : Colors.textSecondary, fontSize: 14, fontWeight: active ? "600" : "400" }}>
          {label}
        </Text>
      </View>
    </Focusable>
  );
}

/** Une pastille qui OUVRE un menu : elle se mesure en fenêtre au moment de
 *  l'appui, pour que le panneau s'ancre dessous. */
function MenuChip({
  label,
  active,
  kind,
  onOpenMenu,
}: {
  label: string;
  active: boolean;
  kind: FilterMenuKind;
  onOpenMenu: (kind: FilterMenuKind, anchor: MenuAnchor) => void;
}) {
  const ref = useRef<View>(null);

  const open = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      onOpenMenu(kind, { x, y, width, height });
    });
  };

  return (
    <View ref={ref} collapsable={false}>
      <FilterChip label={label} active={active} onPress={open} />
    </View>
  );
}
