import { memo } from "react";
import { View, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { CardStatusKind } from "@tentacle-tv/shared";
import { Colors } from "../../theme/colors";
import { TVBookmarkGlyph, TVHeartGlyph, TVWatchedGlyph } from "./tvCardGlyphs";

interface Props {
  /** États vrais, déjà ordonnés (`resolveCardMarkers`). Vide : rien n'est rendu. */
  statuses: readonly CardStatusKind[];
  /** Autre ancrage que le coin haut-droit de l'affiche. */
  style?: StyleProp<ViewStyle>;
}

const GLYPH = 18;
const GAP = 7;
const PADDING_X = 10;

/** La largeur de la pastille pleine — trois glyphes. Ce qui partage son coin
 *  (les puces d'une vignette au focus) s'en écarte d'autant. */
export const TV_STATUS_PILL_MAX_WIDTH = GLYPH * 3 + GAP * 2 + PADDING_X * 2;

/**
 * La pastille d'états d'une affiche du salon — signet (Ma liste), cœur
 * (favori), coche (vu) — dans une capsule d'angle. Le jumeau du web et du
 * mobile, à la taille près : un téléviseur se lit à trois mètres, les glyphes
 * passent de 12 à 18 — comme sur la LG — et la capsule respire davantage.
 *
 * Elle reste visible AU FOCUS : les puces qualité/langues montent en bas de
 * l'affiche, le coin haut-droit est libre. Noir et blanc constants, seul le
 * cœur prend le rose de marque.
 */
export const TVCardStatusMarkers = memo(function TVCardStatusMarkers({ statuses, style }: Props) {
  const { t } = useTranslation("cards");
  if (statuses.length === 0) return null;
  const label = statuses.map((kind) => t(`status.${kind}`)).join(", ");

  return (
    <View style={[styles.pill, style]} accessible accessibilityLabel={label}>
      {statuses.map((kind) =>
        kind === "watchlist" ? (
          <TVBookmarkGlyph key={kind} size={GLYPH} color="#FFFFFF" />
        ) : kind === "favorite" ? (
          <TVHeartGlyph key={kind} size={GLYPH} color={Colors.accentPink} />
        ) : (
          <TVWatchedGlyph key={kind} size={GLYPH} color="#FFFFFF" />
        ),
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    top: 8,
    right: 8,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
    paddingHorizontal: PADDING_X,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
});
