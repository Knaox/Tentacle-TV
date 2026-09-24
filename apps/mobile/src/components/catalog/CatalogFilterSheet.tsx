import { memo, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useGenres } from "@tentacle-tv/api-client";
import { PLATFORMS } from "./PlatformFilter";
import { SORT_OPTIONS } from "./catalogSorts";
import { STATUS_OPTIONS } from "./StatusFilter";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { FilterChip, FilterSection } from "@/components/filters/FilterChip";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const CURRENT_YEAR = new Date().getFullYear();
const RATING_STEPS = [null, 5, 6, 7, 8, 9] as const;

/** Les filtres « de fond » d'un catalogue — le tri, les genres et l'état vivent à part. */
export interface AdvancedFilters {
  studioIds: string[];
  platformIds: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  isFavorite: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  libraryId: string;
  sortIndex: number;
  onSortIndex: (index: number) => void;
  statusFilter: string | null;
  onStatusFilter: (value: string | null) => void;
  selectedGenres: string[];
  onToggleGenre: (id: string) => void;
  onClearGenres: () => void;
  filters: AdvancedFilters;
  onTogglePlatform: (id: number) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onFavoriteChange: (v: boolean) => void;
  onReset: () => void;
  activeCount: number;
  /** Titres correspondants, pour le pied ; `null` pendant le chargement. */
  resultCount: number | null;
}

/**
 * « Trier et filtrer » un catalogue de bibliothèque : TOUT au même endroit —
 * le tri, l'état de visionnage, les genres, les plateformes, les années, la
 * note et les favoris. Le tri, l'ordre et les genres de l'ancienne feuille
 * « Filtres avancés » modifiaient un état que la requête ne lisait jamais :
 * ils agissent désormais sur la grille, comme les pastilles qu'ils remplacent
 * sous la recherche (trois rangées au-dessus de la grille). Chaque geste
 * s'applique aussitôt ; le pied dit combien de titres on va voir.
 */
export const CatalogFilterSheet = memo(function CatalogFilterSheet(props: Props) {
  const {
    visible, onClose, libraryId, sortIndex, onSortIndex, statusFilter, onStatusFilter,
    selectedGenres, onToggleGenre, onClearGenres, filters, onTogglePlatform,
    onYearFromChange, onYearToChange, onRatingMinChange, onFavoriteChange, onReset, activeCount, resultCount,
  } = props;
  const { t } = useTranslation("common");
  const styles = useThemedStyles(makeStyles);
  const { data: genres } = useGenres(libraryId);

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.85, 0.95]}>
      <View style={styles.fill}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">{t("sortAndFilter")}</Text>
          {activeCount > 0 && (
            <Pressable onPress={onReset} hitSlop={8} style={styles.reset} accessibilityRole="button">
              <Text style={styles.resetText}>{t("resetFilters")}</Text>
            </Pressable>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <FilterSection title={t("sortBy")}>
            {SORT_OPTIONS.map((opt, i) => (
              <FilterChip key={opt.labelKey} label={t(opt.labelKey)} active={sortIndex === i} onPress={() => onSortIndex(i)} />
            ))}
          </FilterSection>

          <FilterSection title={t("watchStatus")}>
            {STATUS_OPTIONS.map((opt) => (
              <FilterChip key={opt.labelKey} label={t(opt.labelKey)} active={statusFilter === opt.value} onPress={() => onStatusFilter(opt.value)} />
            ))}
          </FilterSection>

          {genres && genres.length > 0 && (
            <FilterSection title={t("genres")}>
              <FilterChip label={t("allFilter")} active={selectedGenres.length === 0} onPress={onClearGenres} />
              {genres.map((g) => (
                <FilterChip key={g.Id} label={g.Name} active={selectedGenres.includes(g.Id)} onPress={() => onToggleGenre(g.Id)} />
              ))}
            </FilterSection>
          )}

          <FilterSection title={t("platforms")}>
            {PLATFORMS.map((p) => (
              <FilterChip key={p.id} label={p.name} active={filters.platformIds.includes(p.id)} onPress={() => onTogglePlatform(p.id)} />
            ))}
          </FilterSection>

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{t("sortYear")}</Text>
            <View style={styles.yearRow}>
              <YearPicker label={t("yearFrom")} value={filters.yearFrom} onChange={onYearFromChange} />
              <Text style={styles.yearSep}>—</Text>
              <YearPicker label={t("yearTo")} value={filters.yearTo} onChange={onYearToChange} />
            </View>
          </View>

          <FilterSection title={t("ratingMin")}>
            {RATING_STEPS.map((r) => (
              <FilterChip key={r ?? "any"} label={r == null ? t("ratingAny") : `≥ ${r}/10`} active={filters.ratingMin === r} onPress={() => onRatingMinChange(r)} />
            ))}
          </FilterSection>

          <FilterSection title={t("favorites")}>
            <FilterChip label={t("allFilter")} active={!filters.isFavorite} onPress={() => onFavoriteChange(false)} />
            <FilterChip label={`♥ ${t("favorites")}`} active={filters.isFavorite} onPress={() => onFavoriteChange(true)} />
          </FilterSection>
        </ScrollView>

        <View style={styles.foot}>
          <Button
            title={resultCount == null ? t("sortAndFilter") : t("showResultsCount", { count: resultCount })}
            onPress={onClose}
            fullWidth
          />
        </View>
      </View>
    </BottomSheet>
  );
});

function YearPicker({ label, value, onChange }: {
  label: string; value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [showList, setShowList] = useState(false);
  const yearList = useMemo(() => {
    const arr: number[] = [];
    for (let y = CURRENT_YEAR; y >= 1950; y--) arr.push(y);
    return arr;
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.yearLabel}>{label}</Text>
      <Pressable onPress={() => setShowList(!showList)} style={styles.yearButton} accessibilityRole="button" accessibilityLabel={`${label} ${value ?? t("allYears")}`}>
        <Text style={styles.yearButtonText}>{value ?? t("allYears")}</Text>
        <Feather name={showList ? "chevron-up" : "chevron-down"} size={14} color={colors.text.tertiary} />
      </Pressable>
      {showList && (
        <ScrollView style={{ maxHeight: 176, marginTop: 4 }} nestedScrollEnabled>
          <Pressable onPress={() => { onChange(null); setShowList(false); }} style={styles.yearOption}>
            <Text style={[styles.yearOptText, value === null && { color: colors.brand.violet }]}>{t("allYears")}</Text>
          </Pressable>
          {yearList.map((y) => (
            <Pressable key={y} onPress={() => { onChange(y); setShowList(false); }} style={styles.yearOption}>
              <Text style={[styles.yearOptText, value === y && { color: colors.brand.violet }]}>{y}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.md },
  headerTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
  reset: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  resetText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
  content: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xl, gap: spacing.xl },
  section: { gap: 10 },
  sectionTitle: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary, letterSpacing: 0.8, textTransform: "uppercase" },
  yearRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  yearSep: { ...typography.body, color: t.colors.text.quaternary, marginBottom: 12 },
  yearLabel: { ...typography.badge, color: t.colors.text.tertiary, marginBottom: 4 },
  yearButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: t.colors.fill.subtle, borderWidth: 1, borderColor: t.colors.border.subtle, borderRadius: spacing.cardRadius, paddingHorizontal: 12 },
  yearButtonText: { ...typography.caption, fontSize: 14, color: t.colors.text.secondary },
  yearOption: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  yearOptText: { ...typography.caption, fontSize: 14, color: t.colors.text.secondary },
  foot: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md, paddingBottom: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border.subtle },
});
