import { memo, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { OPEN_CARD_MOTION, OPEN_CARD_PAST_OPACITY, previewZoneWatchingMs, type OpenCardMetrics } from "@tentacle-tv/tv-core";
import { AbsentArtwork } from "../cards/AbsentArtwork";
import { CardMarkerLayer } from "../cards/CardMarkerLayer";
import { CardShell } from "../cards/CardShell";
import type { CardModel } from "../cards/cardTypes";
import { useCardFocused } from "../cards/useCardFocused";
import { useCardZoneFocus, useStageSurface } from "../cards/trailerPreviewPort";
import { motionTo } from "../motion/motion";
import { colors, fonts } from "../theme/tokens";
import { OpenVisual } from "./OpenVisual";

/**
 * Une carte de RANGÉE qui s'ouvre (tv-core `cards/openCard.ts`) : une affiche
 * au repos ; focalisée, sa face 16:9 entre en fondu à la même hauteur, pendant
 * que les cartes qui la suivent glissent de la différence — des translations
 * et des opacités seulement, la cellule garde la taille de l'affiche : rien ne
 * se remet en page, HAUT et BAS partent du même endroit.
 *
 * Tout se lit sur le fil d'interface : la rangée tient l'index focalisé
 * (`focused`, -1 sans focus) et le dernier (`anchor`, celui que la rangée pose
 * au bord gauche) ; chaque carte en tire son ouverture, son glissement, et son
 * effacement si elle est PASSÉE (à gauche de la carte ouverte : presque
 * invisible, toujours focalisable).
 *
 * Elle dit son focus à la scène de sa page (`useCardZoneFocus`) : sa
 * bande-annonce s'y joue DERRIÈRE elle, et sa face s'efface quand la vidéo se
 * montre (`watching`). Les détails, sous elle, sont ceux de la rangée.
 */

export interface OpenRowPlace {
  focused: SharedValue<number>;
  anchor: SharedValue<number>;
  index: number;
}

export const OpenCard = memo(function OpenCard({ card, place, metrics, focusKey, onPress, onLongPress, onFocusChange }: {
  card: CardModel;
  place: OpenRowPlace;
  metrics: OpenCardMetrics;
  focusKey: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const { focused, onTargetFocusChange } = useCardFocused(focusKey, onFocusChange);
  useCardZoneFocus(card, focused);
  const surface = useStageSurface(card.id);
  const reduced = useReducedMotion();
  const open = useSharedValue(0);
  const shift = useSharedValue(0);
  const past = useSharedValue(0);
  const watch = useSharedValue(0);
  const { index } = place;
  const delta = metrics.openWidth - metrics.posterWidth;
  useAnimatedReaction(
    () => {
      const at = place.focused.value;
      return { open: at === index ? 1 : 0, shift: at >= 0 && index > at ? 1 : 0, past: index < place.anchor.value ? 1 : 0 };
    },
    (next, previous) => {
      const ms = previous === null ? 0 : OPEN_CARD_MOTION.openMs;
      if (next.open !== previous?.open) open.value = motionTo(next.open, ms, reduced);
      if (next.shift !== previous?.shift) shift.value = motionTo(next.shift, ms, reduced);
      if (next.past !== previous?.past) past.value = motionTo(next.past, ms, reduced);
    },
    [index, reduced],
  );
  // Quittée pendant sa vidéo, elle reprend son image d'un coup, à l'image même où la scène se
  // coupe : sinon une carte transparente le temps qu'elle s'en aille.
  useEffect(() => {
    const watched = surface === "watching";
    watch.value = motionTo(watched ? 1 : 0, previewZoneWatchingMs(watched, surface !== "away"), reduced);
  }, [surface, watch, reduced]);
  const cell = useAnimatedStyle(() => ({
    opacity: 1 - past.value * (1 - OPEN_CARD_PAST_OPACITY),
    transform: [{ translateX: shift.value * delta }],
  }));
  const rest = useAnimatedStyle(() => ({ opacity: 1 - open.value }));
  // La face ouverte n'est montée que pour la carte focalisée (et le temps de sa sortie).
  const visual = useMountedWhile(focused, OPEN_CARD_MOTION.openMs + 80);
  const { height, posterWidth: width, posterRadius: radius } = metrics;
  const uri = card.posterUri ?? card.landscapeUri;
  return (
    <Animated.View collapsable={false} style={[{ width }, cell, focused && styles.front]}>
      <CardShell
        focusKey={focusKey}
        width={width}
        frameHeight={height}
        onPress={onPress}
        onLongPress={onLongPress}
        onTargetFocusChange={onTargetFocusChange}
        accessibilityLabel={card.title}
        frame={
          <Animated.View style={[styles.poster, { width, height, borderRadius: radius }, rest]}>
            {card.absent ? (
              <AbsentArtwork key={uri} absent={card.absent} uri={uri} title={card.title} year={card.subtitle} width={width} height={height} focused={focused} />
            ) : (
              <>
                {uri ? <Image key={uri} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : (
                  <View style={styles.missing}><Text style={styles.missingTitle} numberOfLines={3}>{card.title}</Text></View>
                )}
                <CardMarkerLayer markers={card.markers} progress={card.progress} compact />
              </>
            )}
          </Animated.View>
        }
      >
        {visual ? <OpenVisual card={card} metrics={metrics} open={open} watch={watch} focused={focused} /> : null}
        <Animated.View style={[styles.caption, rest]}>
          <Text style={styles.title} numberOfLines={1}>{card.title}</Text>
          {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
        </Animated.View>
      </CardShell>
    </Animated.View>
  );
});

/** Monté dès que `on`, gardé `exitMs` après. */
function useMountedWhile(on: boolean, exitMs: number): boolean {
  const [mounted, setMounted] = useState(on);
  if (on && !mounted) setMounted(true);
  useEffect(() => {
    if (on) return undefined;
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [on, exitMs]);
  return mounted;
}

const styles = StyleSheet.create({
  front: { zIndex: 10 },
  poster: { overflow: "hidden", backgroundColor: colors.surface1 },
  missing: { flex: 1, padding: 22, justifyContent: "flex-end", backgroundColor: colors.surface3 },
  missingTitle: { ...fonts.bold, fontSize: 26, lineHeight: 30, color: colors.textSecondary },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
