import { memo, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { FAVORITES_GROUP_MODES, favoriteWatchState, type FavoritesGroupMode } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const GROUP_LABELS: Record<FavoritesGroupMode, string> = {
  none: "groupNone",
  type: "groupType",
  status: "groupStatus",
  genre: "groupGenre",
  decade: "groupDecade",
};

interface Props {
  items: MediaItem[];
  type: string;
  status: string | null;
  onStatusChange: (status: string | null) => void;
  groupMode: FavoritesGroupMode;
  onGroupModeChange: (mode: FavoritesGroupMode) => void;
}

/**
 * Sous la barre de filtres de Mes favoris : deux tuiles d'état de 56 qui
 * comptent ET filtrent (À reprendre, Pas encore vus — comptées dans le type
 * choisi, sur la définition du filtre de statut), puis « Regrouper » en
 * pastilles de 36 qui défilent d'un doigt. Même dessin que le miroir web
 * (`mirror/screens/favorites/FavoritesQuickRow`).
 */
export const FavoritesQuickRow = memo(function FavoritesQuickRow({
  items, type, status, onStatusChange, groupMode, onGroupModeChange,
}: Props) {
  const { t } = useTranslation("favorites");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);

  const counts = useMemo(() => {
    let resume = 0;
    let notPlayed = 0;
    for (const item of items) {
      if (type !== "all" && item.Type !== type) continue;
      const state = favoriteWatchState(item);
      if (state === "resume") resume++;
      if (state !== "played") notPlayed++;
    }
    return { resume, notPlayed };
  }, [items, type]);

  const tiles = [
    { key: "IsResumable", icon: "rotate-ccw" as const, label: t("statResume"), count: counts.resume },
    { key: "IsUnplayed", icon: "eye-off" as const, label: t("statUnplayed"), count: counts.notPlayed },
  ];

  return (
    <View style={st.block}>
      <View style={st.tiles} accessibilityLabel={t("quickFilters")}>
        {tiles.map(({ key, icon, label, count }) => {
          const active = status === key;
          const disabled = count === 0 && !active;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`${label}, ${count}`}
              disabled={disabled}
              onPress={() => onStatusChange(active ? null : key)}
              style={({ pressed }) => [st.tile, active && st.tileActive, (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 }]}
            >
              {active ? (
                <LinearGradient colors={[colors.brand.light, colors.brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.iconBox}>
                  <Feather name={icon} size={16} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={[st.iconBox, st.iconBoxIdle]}>
                  <Feather name={icon} size={16} color={colors.brand.light} />
                </View>
              )}
              <View style={st.tileText}>
                <Text style={st.count}>{count}</Text>
                <Text style={[st.label, active && st.labelActive]} numberOfLines={1}>{label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.groupRow} accessibilityRole="radiogroup" accessibilityLabel={t("groupBy")}>
        <Feather name="layers" size={16} color={colors.text.tertiary} />
        {FAVORITES_GROUP_MODES.map((mode) => {
          const selected = mode === groupMode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onGroupModeChange(mode)}
              style={({ pressed }) => [st.chip, selected && st.chipActive, pressed && { opacity: 0.8 }]}
            >
              <Text style={[st.chipText, selected && st.chipTextActive]}>{t(GROUP_LABELS[mode])}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    block: { gap: 10, paddingBottom: spacing.md },
    tiles: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.screenPadding },
    tile: {
      flex: 1,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    tileActive: { borderColor: t.colors.brand.glow, backgroundColor: t.colors.brand.soft },
    iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    iconBoxIdle: { backgroundColor: t.colors.brand.soft },
    tileText: { flex: 1, minWidth: 0 },
    count: { fontSize: 18, lineHeight: 20, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, fontVariant: ["tabular-nums"] },
    label: { ...typography.caption, fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 2 },
    labelActive: { color: t.colors.brand.light, fontFamily: FONT_FAMILY.semibold },
    groupRow: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.screenPadding },
    // La peau de la barre rapide (`QuickChip`) : aplat opaque, liseré fort.
    chip: {
      height: 36,
      justifyContent: "center",
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s1,
    },
    chipActive: { backgroundColor: t.colors.brand.soft, borderColor: t.colors.brand.glow },
    chipText: { ...typography.caption, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    chipTextActive: { color: t.colors.brand.light, fontFamily: FONT_FAMILY.semibold },
  });
