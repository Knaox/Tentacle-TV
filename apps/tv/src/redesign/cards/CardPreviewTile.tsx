import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { trailerPreviewTileSize, type TrailerPreviewTile } from "@tentacle-tv/tv-core";
import { SoftGradient } from "../background/SoftGradient";
import { useMotion } from "../motion/useMotion";
import { colors, fonts, scrim, white } from "../theme/tokens";
import type { CardExpansion } from "./CardShell";
import type { CardModel } from "./cardTypes";
import { useCardPreview } from "./trailerPreviewPort";

/**
 * La GRANDE CARTE de l'aperçu au focus (Apple TV, Android TV), façon Netflix :
 * quand le focus d'une carte de rangée tient et que sa bande-annonce a sa
 * première image (`trailerPreviewPort`), la carte devient une grande vignette
 * 16:9 (tv-core `trailerPreviewTileSize`) où la bande-annonce se joue ; la
 * rangée lui fait place (`CardShell` `expansion`). Le focus parti, elle se
 * replie, plus vite qu'elle n'a grandi.
 *
 * La grande carte se dessine DANS la cible de la carte, par-dessus son image :
 * l'image du titre d'abord (le temps de la croissance), la vidéo dessus, puis
 * le logo ou le titre en bas, sur un voile. Rien ne se monte tant que la
 * carte n'a pas de vidéo à charger.
 */

/** La place de la grande carte sur l'écran de la scène. */
const SCREEN_WIDTH = 1920;
const MAX_TILE_WIDTH = SCREEN_WIDTH - TV_STAGE.contentLeft - TV_STAGE.safe.x;
const TILE_RADIUS = TV_STAGE.card.landscape.radius;
/** Le voile du bas, sous le logo ou le titre : le tiers bas de la grande carte. */
const VEIL_SHARE = 0.42;

export interface CardGrowth {
  tile: TrailerPreviewTile;
  expansion: CardExpansion;
  expanded: boolean;
  video: ReactNode | null;
}

/**
 * L'aperçu d'une carte de rangée : sa grande carte, sa croissance (0 → 1, le
 * mouvement `unfold` : un ressort à l'aller, un retour bref) et sa vidéo.
 * `onExpand` : la carte vient de grandir — la rangée la montre entière.
 */
export function useCardGrowth(
  card: CardModel,
  focused: boolean,
  size: { width: number; height: number },
  onExpand?: (tileWidth: number) => void,
): CardGrowth {
  const preview = useCardPreview(card.trailer ?? null, focused);
  const expanded = preview?.expanded === true;
  const tile = useMemo(
    () => trailerPreviewTileSize({ cardWidth: size.width, cardHeight: size.height, screenWidth: SCREEN_WIDTH, maxWidth: MAX_TILE_WIDTH }),
    [size.width, size.height],
  );
  const progress = useMotion(expanded, "unfold");
  const expansion = useMemo(() => ({ width: tile.width, height: tile.height, progress }), [tile, progress]);
  const expand = useRef(onExpand);
  expand.current = onExpand;
  useEffect(() => {
    if (expanded) expand.current?.(tile.width);
  }, [expanded, tile.width]);
  return { tile, expansion, expanded, video: preview?.video ?? null };
}

export const CardPreviewTile = memo(function CardPreviewTile({
  card,
  width,
  height,
  growth,
}: {
  card: CardModel;
  /** La carte au repos : la grande carte en part. */
  width: number;
  height: number;
  growth: CardGrowth;
}) {
  const { tile, expansion, video } = growth;
  const { progress } = expansion;
  // La grande carte suit la cellule ; elle paraît vite (la première moitié de
  // la croissance) et s'efface pendant le repli.
  const grow = useAnimatedStyle(() => ({
    width: width + (tile.width - width) * progress.value,
    height: height + (tile.height - height) * progress.value,
    opacity: Math.min(1, progress.value * 2),
  }));
  if (!video) return null;
  const still = card.landscapeUri ?? card.posterUri;
  return (
    <Animated.View pointerEvents="none" style={[styles.tile, { width, height, opacity: 0 }, grow]}>
      {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <View style={StyleSheet.absoluteFill}>{video}</View>
      <TileCaption card={card} tile={tile} progress={progress} />
      <View style={[StyleSheet.absoluteFill, styles.hairline]} />
    </Animated.View>
  );
});

/** Le logo de l'œuvre (ou son titre), en bas à gauche, sur un voile : il arrive avec la grande carte. */
function TileCaption({ card, tile, progress }: { card: CardModel; tile: TrailerPreviewTile; progress: SharedValue<number> }) {
  const veilHeight = Math.round(tile.height * VEIL_SHARE);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View style={[styles.caption, { width: tile.width, height: veilHeight }, fade]}>
      <SoftGradient width={tile.width} height={veilHeight} colors={[scrim(0), scrim(0.7)]} locations={[0, 1]} />
      {card.logoUri ? (
        <Image source={{ uri: card.logoUri }} style={styles.logo} resizeMode="contain" fadeDuration={0} />
      ) : (
        <Text style={styles.title} numberOfLines={2}>{card.title}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { position: "absolute", top: 0, left: 0, borderRadius: TILE_RADIUS, overflow: "hidden", backgroundColor: colors.surface2 },
  hairline: { borderRadius: TILE_RADIUS, borderWidth: 1, borderColor: white(0.12) },
  caption: { position: "absolute", left: 0, bottom: 0, justifyContent: "flex-end", paddingHorizontal: 32, paddingBottom: 26 },
  logo: { width: 300, height: 96, alignSelf: "flex-start" },
  title: { ...fonts.bold, fontSize: 36, lineHeight: 42, color: colors.text, maxWidth: 640 },
});
