import { memo } from "react";
import { ScrollView, Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/theme";

/** TMDB Watch Provider IDs — identique au plugin Seer */
export const PLATFORMS = [
  { id: 8, name: "Netflix", studioNames: ["Netflix"] },
  { id: 337, name: "Disney+", studioNames: ["Disney+", "Disney Plus", "Disney Television Studios"] },
  { id: 119, name: "Amazon Prime Video", studioNames: ["Amazon Studios", "Amazon Prime Video"] },
  { id: 283, name: "Crunchyroll", studioNames: ["Crunchyroll"] },
  { id: 350, name: "Apple TV+", studioNames: ["Apple TV+", "Apple Studios", "Apple"] },
  { id: 531, name: "Paramount+", studioNames: ["Paramount+", "Paramount Plus"] },
  { id: 1899, name: "Max", studioNames: ["Max", "HBO Max", "HBO"] },
  { id: 415, name: "ADN", studioNames: ["ADN"] },
  { id: 56, name: "OCS", studioNames: ["OCS"] },
  { id: 381, name: "Canal+", studioNames: ["Canal+", "Canal Plus"] },
  { id: 236, name: "Arte", studioNames: ["Arte", "ARTE"] },
] as const;

interface Props {
  selectedPlatformIds: number[];
  onTogglePlatform: (id: number) => void;
}

export const PlatformFilter = memo(function PlatformFilter({ selectedPlatformIds, onTogglePlatform }: Props) {
  const { t } = useTranslation("common");

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
                <Feather name="check" size={12} color={colors.accent} style={{ marginRight: 4 }} />
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

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.screenPadding, gap: spacing.xs, paddingVertical: spacing.xs },
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
