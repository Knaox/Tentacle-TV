import { memo, useCallback } from "react";
import { ScrollView, Pressable, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useStudios } from "@tentacle-tv/api-client";
import { spacing, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  libraryId: string;
  selectedStudios: string[];
  onStudiosChange: (studios: string[]) => void;
}

export const StudioFilter = memo(function StudioFilter({ libraryId, selectedStudios, onStudiosChange }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { data: studios, isLoading } = useStudios(libraryId);

  const toggleStudio = useCallback(
    (studioId: string) => {
      onStudiosChange(
        selectedStudios.includes(studioId)
          ? selectedStudios.filter((s) => s !== studioId)
          : [...selectedStudios, studioId],
      );
    },
    [selectedStudios, onStudiosChange],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.brand.violet} />
      </View>
    );
  }

  if (!studios || studios.length === 0) return null;

  const isAllSelected = selectedStudios.length === 0;

  return (
    <View>
      <Text style={styles.label}>Plateformes / Studios</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        style={{ maxHeight: 42 }}
      >
        {/* Chip "Tous" */}
        <Pressable
          onPress={() => onStudiosChange([])}
          style={[styles.chip, isAllSelected && styles.chipActive]}
        >
          <Text style={[styles.chipText, isAllSelected && styles.chipTextActive]}>
            {t("allFilter")}
          </Text>
        </Pressable>

        {studios.map((studio) => {
          const isActive = selectedStudios.includes(studio.Id);
          return (
            <Pressable
              key={studio.Id}
              onPress={() => toggleStudio(studio.Id)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              {isActive && (
                <Feather name="check" size={12} color={colors.text.primary} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>
                {studio.Name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { paddingHorizontal: spacing.screenPadding, gap: spacing.xs, paddingVertical: spacing.xs },
  loadingContainer: { paddingVertical: spacing.md, alignItems: "center" },
  label: {
    ...typography.badge,
    color: t.colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 2,
    fontWeight: "600",
  },
  chip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: t.colors.surface.s2,
    borderWidth: 1,
    borderColor: t.colors.border.subtle,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
  },
  chipActive: {
    backgroundColor: t.colors.brand.soft,
    borderColor: withAlpha(t.colors.brand.violet, 0.5, t.colors.brand.glow),
  },
  chipText: { ...typography.caption, color: t.colors.text.secondary, lineHeight: 16 },
  chipTextActive: { color: t.colors.brand.violet, fontWeight: "600" },
});
