import { memo } from "react";
import { View, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { CardStatusKind } from "@tentacle-tv/shared";
import { useTheme } from "@/theme";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "./cardGlyphs";

interface Props {
  /** États vrais, déjà ordonnés (`resolveCardMarkers`). Vide : rien n'est rendu. */
  statuses: readonly CardStatusKind[];
  /** Autre ancrage que le coin haut-droit de l'affiche. */
  style?: StyleProp<ViewStyle>;
}

const GLYPH = 12;

/**
 * La pastille d'états d'une affiche — signet (Ma liste), cœur (favori),
 * coche (vu) — dans UNE capsule d'angle, façon Crunchyroll. Le jumeau de
 * celle du web : même ordre, mêmes glyphes (`cardGlyphs`, tracés partagés).
 *
 * Posée SUR l'affiche : noir à 70 % et blanc constants dans les deux thèmes,
 * seul le cœur prend l'accent de marque. Aucune forme ne repose sur la
 * couleur seule, et un seul libellé lu pour toute la capsule.
 */
export const CardStatusMarkers = memo(function CardStatusMarkers({ statuses, style }: Props) {
  const { t } = useTranslation("cards");
  const theme = useTheme();
  if (statuses.length === 0) return null;
  const label = statuses.map((kind) => t(`status.${kind}`)).join(", ");

  return (
    <View
      style={[styles.pill, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      pointerEvents="none"
    >
      {statuses.map((kind) =>
        kind === "watchlist" ? (
          <BookmarkGlyph key={kind} size={GLYPH} color="#FFFFFF" filled />
        ) : kind === "favorite" ? (
          <HeartGlyph key={kind} size={GLYPH} color={theme.colors.brand.accent} filled />
        ) : (
          <WatchedGlyph key={kind} size={GLYPH} color="#FFFFFF" filled />
        ),
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    top: 7,
    right: 7,
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
});
