import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { seasonKey } from "@tentacle-tv/offline-core";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { formatBytes } from "../formatBytes";

export interface SeasonGroup {
  key: string;
  number: number | null;
  episodes: MediaItem[];
}

/** La clé de saison vit dans le cœur : le bureau la partage. */
export { seasonKey };

/** Les épisodes d'une série regroupés par saison, dans l'ordre des numéros. */
export function groupBySeason(episodes: readonly MediaItem[]): SeasonGroup[] {
  const groups = new Map<string, SeasonGroup>();
  for (const episode of episodes) {
    const key = seasonKey(episode);
    const group = groups.get(key) ?? { key, number: episode.ParentIndexNumber ?? null, episodes: [] };
    group.episodes.push(episode);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));
}

interface Props {
  episodes: readonly MediaItem[];
  uncheckedSeasons: ReadonlySet<string>;
  onDevice: ReadonlySet<string>;
  sizeOf: (item: MediaItem) => number | null;
  onToggle: (seasonKey: string) => void;
}

/** « Saisons à garder » : une ligne cochable par saison, toutes cochées au départ. */
export function SeasonChecklist({ episodes, uncheckedSeasons, onDevice, sizeOf, onToggle }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const groups = useMemo(() => groupBySeason(episodes), [episodes]);

  return (
    <View style={st.wrap}>
      <Text style={st.label}>{to("seasonsPickerLabel")}</Text>
      {groups.map((group) => {
        const remaining = group.episodes.filter((episode) => !onDevice.has(episode.Id));
        const already = group.episodes.length - remaining.length;
        const allKept = remaining.length === 0;
        const checked = !allKept && !uncheckedSeasons.has(group.key);
        let total: number | null = 0;
        for (const episode of remaining) {
          const size = sizeOf(episode);
          if (size === null) { total = null; break; }
          total += size;
        }
        const parts = [
          group.number === null ? t("seasonUnknown") : t("seasonLabel", { num: group.number }),
          t("episodesCount", { count: group.episodes.length }),
        ];
        if (total !== null && remaining.length > 0) parts.push(formatBytes(total));
        if (already > 0) parts.push(to("alreadyOnDevice", { count: already }));
        return (
          <Pressable
            key={group.key}
            onPress={() => !allKept && onToggle(group.key)}
            disabled={allKept}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: checked || allKept, disabled: allKept }}
            style={[st.row, allKept && st.rowKept]}
          >
            <View style={[st.box, (checked || allKept) && st.boxChecked]}>
              {(checked || allKept) && <Feather name="check" size={14} color={colors.cta.brandFg} />}
            </View>
            <Text style={st.title} numberOfLines={2}>{parts.join(" · ")}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      backgroundColor: t.colors.fill.faint,
    },
    rowKept: { opacity: 0.5 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.colors.border.strong,
      alignItems: "center",
      justifyContent: "center",
    },
    boxChecked: { backgroundColor: t.colors.brand.violet, borderColor: withAlpha(t.colors.brand.violet, 0.6, t.colors.brand.glow) },
    title: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, flex: 1, lineHeight: 17 },
  });
