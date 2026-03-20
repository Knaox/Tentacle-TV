import { memo, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useGenres } from "@tentacle-tv/api-client";
import { PLATFORMS } from "./PlatformFilter";
import { BottomSheet } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

const CURRENT_YEAR = new Date().getFullYear();
const RATING_STEPS = [null, 5, 6, 7, 8, 9] as const;

const SORT_ADVANCED = [
  { key: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { key: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { key: "sortYear", sortBy: "ProductionYear", sortOrder: "Descending" },
  { key: "sortRatingDesc", sortBy: "CommunityRating", sortOrder: "Descending" },
] as const;

export interface AdvancedFilters {
  genreIds: string[];
  studioIds: string[];
  platformIds: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  isFavorite: boolean;
  sortBy: string;
  sortOrder: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  libraryId: string;
  filters: AdvancedFilters;
  onToggleGenre: (id: string) => void;
  onToggleStudio: (id: string) => void;
  onTogglePlatform: (id: number) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onFavoriteChange: (v: boolean) => void;
  onSortByChange: (sortBy: string, sortOrder: string) => void;
  onReset: () => void;
  activeCount: number;
}

export const AdvancedFilterSheet = memo(function AdvancedFilterSheet({
  visible, onClose, libraryId, filters,
  onToggleGenre, onToggleStudio: _onToggleStudio, onTogglePlatform, onYearFromChange, onYearToChange,
  onRatingMinChange, onFavoriteChange, onSortByChange, onReset, activeCount,
}: Props) {
  const { t } = useTranslation("common");
  const { data: genres } = useGenres(libraryId);


  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.85, 0.95]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="sliders" size={18} color={colors.accent} />
          <Text style={styles.headerTitle}>{t("advancedFilters")}</Text>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </View>
        {activeCount > 0 && (
          <Pressable onPress={onReset} hitSlop={8}>
            <Text style={styles.resetText}>{t("resetFilters")}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* ── Tri ── */}
        <Section title={t("sortBy")}>
          <View style={styles.chipRow}>
            {SORT_ADVANCED.map((opt) => {
              const active = filters.sortBy === opt.sortBy;
              return (
                <Chip key={opt.key} active={active} onPress={() => onSortByChange(opt.sortBy, opt.sortOrder)}>
                  {t(opt.key)}
                </Chip>
              );
            })}
          </View>
          <View style={[styles.chipRow, { marginTop: spacing.xs }]}>
            <Chip active={filters.sortOrder === "Ascending"} onPress={() => onSortByChange(filters.sortBy, "Ascending")}>
              ↑ {t("sortOrderAsc")}
            </Chip>
            <Chip active={filters.sortOrder === "Descending"} onPress={() => onSortByChange(filters.sortBy, "Descending")}>
              ↓ {t("sortOrderDesc")}
            </Chip>
          </View>
        </Section>

        {/* ── Genres ── */}
        {genres && genres.length > 0 && (
          <Section title={t("genres")}>
            <View style={styles.chipRow}>
              {genres.map((g) => (
                <Chip key={g.Id} active={filters.genreIds.includes(g.Id)} onPress={() => onToggleGenre(g.Id)}>
                  {g.Name}
                </Chip>
              ))}
            </View>
          </Section>
        )}

        {/* ── Plateformes ── */}
        <Section title="Plateformes">
          <View style={styles.chipRow}>
            {PLATFORMS.map((p) => (
              <Chip
                key={p.id}
                active={filters.platformIds.includes(p.id)}
                onPress={() => onTogglePlatform(p.id)}
              >
                {p.name}
              </Chip>
            ))}
          </View>
        </Section>

        {/* ── Année ── */}
        <Section title={t("sortYear")}>
          <View style={styles.yearRow}>
            <YearPicker label={t("yearFrom")} value={filters.yearFrom} onChange={onYearFromChange} />
            <Text style={styles.yearSep}>—</Text>
            <YearPicker label={t("yearTo")} value={filters.yearTo} onChange={onYearToChange} />
          </View>
        </Section>

        {/* ── Note minimum ── */}
        <Section title={t("ratingMin")}>
          <View style={styles.chipRow}>
            {RATING_STEPS.map((r) => (
              <Chip key={r ?? "any"} active={filters.ratingMin === r} onPress={() => onRatingMinChange(r)}>
                {r == null ? t("ratingAny") : `≥ ${r}/10`}
              </Chip>
            ))}
          </View>
        </Section>

        {/* ── Favoris ── */}
        <Section title={t("favorites")}>
          <View style={styles.chipRow}>
            <Chip active={!filters.isFavorite} onPress={() => onFavoriteChange(false)}>{t("allFilter")}</Chip>
            <Chip active={filters.isFavorite} onPress={() => onFavoriteChange(true)}>♥ {t("favorites")}</Chip>
          </View>
        </Section>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </BottomSheet>
  );
});

/* ── Sous-composants ──────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ active, onPress, children }: { active: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </Pressable>
  );
}

function YearPicker({ label, value, onChange }: {
  label: string; value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { t } = useTranslation("common");
  const [showList, setShowList] = useState(false);
  const yearList = useMemo(() => {
    const arr: number[] = [];
    for (let y = CURRENT_YEAR; y >= 1950; y--) arr.push(y);
    return arr;
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.yearLabel}>{label}</Text>
      <Pressable onPress={() => setShowList(!showList)} style={styles.yearButton}>
        <Text style={styles.yearButtonText}>{value ?? t("allYears")}</Text>
        <Feather name={showList ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
      </Pressable>
      {showList && (
        <ScrollView style={{ maxHeight: 150, marginTop: 4 }} nestedScrollEnabled>
          <Pressable onPress={() => { onChange(null); setShowList(false); }} style={styles.yearOption}>
            <Text style={[styles.yearOptText, value === null && { color: colors.accent }]}>{t("allYears")}</Text>
          </Pressable>
          {yearList.map((y) => (
            <Pressable key={y} onPress={() => { onChange(y); setShowList(false); }} style={styles.yearOption}>
              <Text style={[styles.yearOptText, value === y && { color: colors.accent }]}>{y}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.md },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { ...typography.subtitle, color: colors.textPrimary },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  resetText: { ...typography.caption, color: colors.textMuted },
  content: { paddingHorizontal: spacing.screenPadding },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderAccent, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.caption, color: colors.textSecondary, lineHeight: 16 },
  chipTextActive: { color: colors.textPrimary, fontWeight: "600" },
  yearRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  yearSep: { ...typography.body, color: colors.textDim, marginBottom: spacing.sm },
  yearLabel: { ...typography.badge, color: colors.textMuted, marginBottom: 4 },
  yearButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderAccent, borderRadius: spacing.cardRadius, paddingHorizontal: 12, paddingVertical: 10 },
  yearButtonText: { ...typography.caption, color: colors.textSecondary },
  yearOption: { paddingVertical: 8, paddingHorizontal: 4 },
  yearOptText: { ...typography.caption, color: colors.textSecondary },
});
