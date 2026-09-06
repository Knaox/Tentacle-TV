import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  seasons: MediaItem[];
  activeSeasonId: string | undefined;
  onSelect: (seasonId: string) => void;
}

/**
 * Les pilules de saison, générique : la fiche de série en ligne comme la vue
 * d'une série locale. La sélection parle ROSE — même langage que l'épisode
 * courant du bureau (accent-soft / accent-light).
 */
export function SeasonPills({ seasons, activeSeasonId, onSelect }: Props) {
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeStyles);
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;

  return (
    <FlatList
      horizontal
      data={seasons}
      keyExtractor={(season) => season.Id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.list}
      renderItem={({ item: season }) => {
        const isActive = activeSeasonId === season.Id;
        return (
          <Pressable
            onPress={() => onSelect(season.Id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[st.pill, isActive && st.pillActive]}
          >
            <Text style={[st.label, isActive && { color: accentText, fontFamily: FONT_FAMILY.semibold }]}>
              {season.Name}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
    pill: {
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      minHeight: 36,
      justifyContent: "center",
    },
    pillActive: {
      backgroundColor: withAlpha(t.colors.brand.accent, 0.15, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.accent, 0.45, t.colors.brand.glow),
    },
    label: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.medium, letterSpacing: 0.1 },
  });
