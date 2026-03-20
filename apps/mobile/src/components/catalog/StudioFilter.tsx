import { memo, useCallback } from "react";
import { ScrollView, Pressable, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useStudios } from "@tentacle-tv/api-client";
import { colors, spacing, typography } from "@/theme";

interface Props {
  libraryId: string;
  selectedStudios: string[];
  onStudiosChange: (studios: string[]) => void;
}

export const StudioFilter = memo(function StudioFilter({ libraryId, selectedStudios, onStudiosChange }: Props) {
  const { t } = useTranslation("common");
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
        <ActivityIndicator size="small" color={colors.accent} />
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
                <Feather name="check" size={12} color={colors.textPrimary} style={{ marginRight: 4 }} />
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

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.screenPadding, gap: spacing.xs, paddingVertical: spacing.xs },
  loadingContainer: { paddingVertical: spacing.md, alignItems: "center" },
  label: {
    ...typography.badge,
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
  },
  chipActive: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderColor: "rgba(139,92,246,0.5)",
  },
  chipText: { ...typography.caption, color: colors.textSecondary, lineHeight: 16 },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
});
