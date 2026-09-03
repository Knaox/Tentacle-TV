import { memo } from "react";
import { ScrollView, Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { spacing, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

// Les plateformes viennent de la constante partagée (familles d'ids TMDB,
// ids principaux corrigés) ; ré-exportées pour AdvancedFilterSheet.
import { PLATFORMS } from "@tentacle-tv/shared";
export { PLATFORMS };

interface Props {
  selectedPlatformIds: number[];
  onTogglePlatform: (id: number) => void;
}

export const PlatformFilter = memo(function PlatformFilter({ selectedPlatformIds, onTogglePlatform }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View>
      <Text style={styles.label}>Plateformes</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        style={{ maxHeight: 42 }}
      >
        <Pressable
          onPress={() => selectedPlatformIds.forEach(onTogglePlatform)}
          style={[styles.chip, selectedPlatformIds.length === 0 && styles.chipActive]}
        >
          <Text style={[styles.chipText, selectedPlatformIds.length === 0 && styles.chipTextActive]}>
            {t("allFilter")}
          </Text>
        </Pressable>

        {PLATFORMS.map((p) => {
          const isActive = selectedPlatformIds.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => onTogglePlatform(p.id)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              {isActive && (
                <Feather name="check" size={12} color={colors.brand.violet} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>
                {p.name}
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
