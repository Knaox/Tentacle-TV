import { memo } from "react";
import { View, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { cardDeviceLabelKey, type CardDeviceState, type CardStatusKind } from "@tentacle-tv/shared";
import { useTheme } from "@/theme";
import { BookmarkGlyph, HeartGlyph, KeptGlyph, WatchedGlyph } from "./cardGlyphs";

interface Props {
  /** États vrais, déjà ordonnés (`resolveCardMarkers`). Vide : rien n'est rendu. */
  statuses: readonly CardStatusKind[];
  /** « Sur cet appareil », au bout de la pastille — `null` : rien de gardé ici. */
  device?: CardDeviceState | null;
  /** Autre ancrage que le coin haut-droit de l'affiche. */
  style?: StyleProp<ViewStyle>;
}

const GLYPH = 12;
/**
 * Le vert de « prêt », CONSTANT (posé sur média) : le même que le web. Le vert
 * de succès du thème clair est sombre, illisible sur la pastille noire.
 */
const KEPT_GREEN = "#34D399";

/**
 * La pastille d'états d'une affiche — signet (Ma liste), cœur (favori),
 * coche (vu), puis « sur cet appareil » — dans UNE capsule d'angle, façon
 * Crunchyroll. Le jumeau de
 * celle du web : même ordre, mêmes glyphes (`cardGlyphs`, tracés partagés).
 *
 * Posée SUR l'affiche : noir à 70 % et blanc constants dans les deux thèmes,
 * seul le cœur prend l'accent de marque. Aucune forme ne repose sur la
 * couleur seule, et un seul libellé lu pour toute la capsule.
 */
export const CardStatusMarkers = memo(function CardStatusMarkers({ statuses, device = null, style }: Props) {
  const { t } = useTranslation("cards");
  const theme = useTheme();
  if (statuses.length === 0 && device === null) return null;
  const parts = statuses.map((kind) => t(`status.${kind}`));
  if (device !== null) parts.push(t(cardDeviceLabelKey(device)));
  const label = parts.join(", ");

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
      {/* Après les états : l'ordre même de la feuille, où « garder hors ligne »
          suit les bascules. */}
      {device !== null && <KeptGlyph size={GLYPH} color={KEPT_GREEN} />}
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
