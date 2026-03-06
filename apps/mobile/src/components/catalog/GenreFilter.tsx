import { memo, useCallback } from "react";
import { ScrollView, Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import { colors, spacing, typography } from "@/theme";

interface Props {
  libraryId: string;
  selectedGenres: string[];
  onGenresChange: (genres: string[]) => void;
}

export const GenreFilter = memo(function GenreFilter({ libraryId, selectedGenres, onGenresChange }: Props) {
  const { t } = useTranslation("common");
  const { data: genres, isLoading } = useGenres(libraryId);

  const toggleGenre = useCallback(
    (genreId: string) => {
      onGenresChange(
        selectedGenres.includes(genreId)
          ? selectedGenres.filter((g) => g !== genreId)
          : [...selectedGenres, genreId],
      );
    },
    [selectedGenres, onGenresChange],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (!genres || genres.length === 0) return null;

  const isAllSelected = selectedGenres.length === 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={{ maxHeight: 42 }}
    >
      {/* Chip "Tous" */}
      <Pressable
        onPress={() => onGenresChange([])}
        style={[styles.chip, isAllSelected && styles.chipActive]}
      >
        <Text style={[styles.chipText, isAllSelected && styles.chipTextActive]}>
          {t("allGenres")}
        </Text>
      </Pressable>

      {genres.map((genre) => {
        const isActive = selectedGenres.includes(genre.Id);
        return (
          <Pressable
            key={genre.Id}
            onPress={() => toggleGenre(genre.Id)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {genre.Name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.screenPadding, gap: spacing.xs, paddingVertical: spacing.xs },
  loadingContainer: { paddingVertical: spacing.md, alignItems: "center" },
  chip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.caption, color: colors.textSecondary, lineHeight: 16 },
  chipTextActive: { color: colors.textPrimary, fontWeight: "600" },
});
