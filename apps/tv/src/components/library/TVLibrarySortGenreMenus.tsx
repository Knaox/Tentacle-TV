import { useRef } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import { Focusable } from "../focus/Focusable";
import { TVLibraryFilterMenu, TVCheckRow, type MenuAnchor } from "./TVLibraryFilterMenu";
import type { LibraryFilterState } from "../../hooks/useLibraryFilters";
import { Colors } from "../../theme/colors";

/**
 * Chaque critère porte son sens NATUREL (parité `LibraryFilterMenus` web) :
 * choisir « derniers ajouts » pose l'ordre décroissant, la note aussi — le
 * bouton d'inversion reste disponible dessous pour le cas contraire.
 */
export const SORT_OPTIONS = [
  { value: "DateCreated", key: "sortDateDesc", order: "Descending" },
  { value: "SortName", key: "sortTitleAsc", order: "Ascending" },
  { value: "ProductionYear", key: "sortYear", order: "Descending" },
  { value: "CommunityRating", key: "sortRatingDesc", order: "Descending" },
] as const;

export function TVSortMenu({
  anchor,
  filters,
  onSortByChange,
  onSortOrderChange,
}: {
  anchor: MenuAnchor;
  filters: LibraryFilterState;
  onSortByChange: (v: string) => void;
  onSortOrderChange: (v: string) => void;
}) {
  const { t } = useTranslation("common");
  const desc = filters.sortOrder === "Descending";
  // Cible d'entrée FIGÉE à l'ouverture : suivre la sélection re-grabberait le
  // focus à chaque cochage (le flip de hasTVPreferredFocus re-saisit côté natif).
  const entreeRef = useRef(filters.sortBy);

  return (
    <TVLibraryFilterMenu anchor={anchor}>
      {SORT_OPTIONS.map((opt) => (
        <TVCheckRow
          key={opt.value}
          label={t(opt.key)}
          checked={filters.sortBy === opt.value}
          preferred={entreeRef.current === opt.value}
          onPress={() => { onSortByChange(opt.value); onSortOrderChange(opt.order); }}
        />
      ))}
      <View style={{ height: 1, backgroundColor: Colors.glassBorder, marginVertical: 8 }} />
      <Focusable
        variant="button"
        onPress={() => onSortOrderChange(desc ? "Ascending" : "Descending")}
        accessibilityLabel={desc ? t("sortOrderDesc") : t("sortOrderAsc")}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46, paddingHorizontal: 12 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d={desc ? "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" : "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"} />
          </Svg>
          <Text style={{ fontSize: 18, color: Colors.textSecondary }}>
            {desc ? t("sortOrderDesc") : t("sortOrderAsc")}
          </Text>
        </View>
      </Focusable>
    </TVLibraryFilterMenu>
  );
}

export function TVGenreMenu({
  anchor,
  genres,
  selectedIds,
  onToggle,
}: {
  anchor: MenuAnchor;
  genres: Array<{ Id: string; Name: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  // Entrée sur la PREMIÈRE cochée à l'OUVERTURE, sinon la première ligne —
  // figée : cocher/décocher ne doit pas re-saisir le focus.
  const entreeRef = useRef(genres.find((g) => selectedIds.includes(g.Id))?.Id ?? genres[0]?.Id);
  const firstChecked = entreeRef.current;

  return (
    <TVLibraryFilterMenu anchor={anchor}>
      {genres.map((genre) => (
        <TVCheckRow
          key={genre.Id}
          label={genre.Name}
          checked={selectedIds.includes(genre.Id)}
          preferred={genre.Id === firstChecked}
          onPress={() => onToggle(genre.Id)}
        />
      ))}
    </TVLibraryFilterMenu>
  );
}
