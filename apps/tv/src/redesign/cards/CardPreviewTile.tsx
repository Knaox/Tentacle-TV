import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { trailerPreviewTileFrom, trailerPreviewTileSize, type TrailerPreviewTile } from "@tentacle-tv/tv-core";
import { SoftGradient } from "../background/SoftGradient";
import { useMotion } from "../motion/useMotion";
import { colors, fonts, scrim, white } from "../theme/tokens";
import type { CardExpansion } from "./CardShell";
import { CARD_FOCUS_SCALE } from "./cardFocus";
import { useCardMetrics } from "./cardSizeMode";
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
 * le logo ou le titre en bas, sur un voile. Elle part de la carte TELLE
 * QU'ELLE SE DESSINE au focus — agrandie et soulevée (tv-core
 * `trailerPreviewTileFrom`) —, et la carte s'efface dessous
 * (`UnderPreviewTile`) : rien d'elle ne dépasse de la vidéo, ni ses bords
 * agrandis ni sa lueur. Sa taille suit le réglage « Taille des cartes ».
 * Rien ne se monte tant que la carte n'a pas de vidéo à charger.
 */

/** La place de la grande carte sur l'écran de la scène. */
const SCREEN_WIDTH = 1920;
const MAX_TILE_WIDTH = SCREEN_WIDTH - TV_STAGE.contentLeft - TV_STAGE.safe.x;
const TILE_RADIUS = TV_STAGE.card.landscape.radius;
/** Le voile du bas, sous le logo ou le titre : le tiers bas de la grande carte. */
const VEIL_SHARE = 0.42;
/** Le soulèvement de la carte focalisée (`CardFrame`) : nul sans agrandissement (Lite). */
const FOCUS_LIFT = CARD_FOCUS_SCALE === 1 ? 0 : 4;

export interface CardGrowth {
  tile: TrailerPreviewTile;
  expansion: CardExpansion;
  expanded: boolean;
  video: ReactNode | null;
}

/**
 * L'aperçu d'une carte de rangée : sa grande carte, sa croissance (0 → 1, le
 * mouvement `unfold` : un ressort à l'aller, un retour bref) et sa vidéo.
 * `onExpand` : la carte va grandir — la rangée lui réserve sa place et la
 * montre entière ; `onCollapse` : elle se replie.
 */
export function useCardGrowth(
  card: CardModel,
  focused: boolean,
  size: { width: number; height: number },
  onExpand?: (tileWidth: number, tileHeight: number) => void,
  onCollapse?: () => void,
): CardGrowth {
  const preview = useCardPreview(card.trailer ?? null, focused);
  const expanded = preview?.expanded === true;
  const { scale } = useCardMetrics();
  const tile = useMemo(
    () => trailerPreviewTileSize({ cardWidth: size.width, cardHeight: size.height, screenWidth: SCREEN_WIDTH, maxWidth: MAX_TILE_WIDTH, sizeScale: scale }),
    [size.width, size.height, scale],
  );
  const progress = useMotion(expanded, "unfold");
  const expansion = useMemo(() => ({ width: tile.width, height: tile.height, progress }), [tile, progress]);
  const handlers = useRef({ onExpand, onCollapse });
  handlers.current = { onExpand, onCollapse };
  const wasExpanded = useRef(false);
  useEffect(() => {
    if (expanded) handlers.current.onExpand?.(tile.width, tile.height);
    else if (wasExpanded.current) handlers.current.onCollapse?.();
    wasExpanded.current = expanded;
  }, [expanded, tile.width, tile.height]);
  return { tile, expansion, expanded, video: preview?.video ?? null };
}

/**
 * La carte SOUS sa grande carte : elle s'efface pendant que la grande carte
 * la recouvre (du tiers aux deux tiers de la croissance — la grande carte est
 * alors opaque), et reparaît au repli. Sans cela, la carte agrandie du focus
 * et sa lueur dépassaient de la vidéo.
 */
export function UnderPreviewTile({ growth, children }: { growth: CardGrowth; children: ReactNode }) {
  const { progress } = growth.expansion;
  const fade = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.max(0, progress.value * 3 - 1)) }));
  return <Animated.View style={fade}>{children}</Animated.View>;
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
  // Le départ : la carte telle qu'elle se dessine au focus, agrandie et soulevée.
  const from = useMemo(() => trailerPreviewTileFrom({ cardWidth: width, cardHeight: height, focusScale: CARD_FOCUS_SCALE, lift: FOCUS_LIFT }), [width, height]);
  // La grande carte va de la carte focalisée à toute la cellule agrandie ;
  // elle est opaque au premier tiers de la croissance, et s'efface au repli.
  const grow = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      left: from.left * (1 - p),
      top: from.top * (1 - p),
      width: from.width + (tile.width - from.width) * p,
      height: from.height + (tile.height - from.height) * p,
      opacity: Math.min(1, p * 3),
    };
  });
  if (!video) return null;
  const still = card.landscapeUri ?? card.posterUri;
  return (
    <Animated.View pointerEvents="none" style={[styles.tile, { left: from.left, top: from.top, width: from.width, height: from.height, opacity: 0 }, grow]}>
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
  tile: { position: "absolute", borderRadius: TILE_RADIUS, overflow: "hidden", backgroundColor: colors.surface2 },
  hairline: { borderRadius: TILE_RADIUS, borderWidth: 1, borderColor: white(0.12) },
  caption: { position: "absolute", left: 0, bottom: 0, justifyContent: "flex-end", paddingHorizontal: 32, paddingBottom: 26 },
  logo: { width: 300, height: 96, alignSelf: "flex-start" },
  title: { ...fonts.bold, fontSize: 36, lineHeight: 42, color: colors.text, maxWidth: 640 },
});
