import { Pressable, StyleSheet, Text } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { typography, FONT_FAMILY, useTheme } from "@/theme";
import { KeepOfflineGlyph } from "./KeepOfflineGlyph";
import { useKeepOfflineEntry } from "./useKeepOfflineEntry";

interface Props {
  item: MediaItem;
}

/**
 * Le quatrième bouton rond de la fiche (film, épisode) : « Garder hors
 * ligne » → « En préparation » → « Sur l'appareil ». Même cellule que
 * `DetailActionButton` (25 %, 88 pt) pour une rangée uniforme.
 */
export function DetailKeepOfflineButton({ item }: Props) {
  const { colors } = useTheme();
  const entry = useKeepOfflineEntry(item);
  if (!entry.visible) return null;
  const complete = entry.state === "complete";
  return (
    <Pressable
      onPress={entry.onPress}
      style={({ pressed }) => [st.cell, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={entry.label}
      accessibilityState={{ selected: complete }}
      hitSlop={4}
    >
      <KeepOfflineGlyph state={entry.state} size={52} iconSize={22} />
      <Text numberOfLines={1} ellipsizeMode="tail" style={[st.label, { color: complete ? colors.brand.violet : colors.text.secondary }]}>
        {entry.label}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  cell: {
    width: "25%" as unknown as number,
    height: 88,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
    gap: 8,
  },
  label: {
    ...typography.badge,
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 11.5,
    letterSpacing: 0.2,
    textAlign: "center",
    maxWidth: 80,
  },
});
