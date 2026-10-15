import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { RAIL_HOME_KEY } from "@tentacle-tv/tv-core";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { EASE, MOTION_ENABLED } from "../../motion/motion";
import { colors, fonts, text, white } from "../../theme/tokens";
import type { RailPreviewEntry } from "./railSetupTypes";

/**
 * L'APERÇU de la barre, à la place exacte où elle vivra — la capsule des pages
 * telle qu'elle s'ouvre : Rechercher, le filet, Accueil (la page courante, au
 * verre allumé), puis ce qui sera affiché, dans l'ordre. Il suit la liste en
 * direct : une bibliothèque épinglée y entre en fondu, celle qu'on survole s'y
 * éclaire, celle qu'on déplace y porte le liseré de la marque.
 *
 * Rien n'y est focalisable : c'est un dessin. Avec beaucoup d'entrées, la
 * capsule garde la hauteur de la vraie barre et suit l'entrée éclairée.
 */

const N = TV_STAGE.nav;
const WIDTH = N.expandedWidth;
const INSET = (N.collapsedWidth - N.itemHeight) / 2;
const GAP = 8;
const PITCH = N.itemHeight + GAP;
/** La hauteur visible de la liste : celle de la vraie barre, moins Rechercher et le filet. */
const LIST_MAX = 720;
const SCROLL_MS = 240;

/** Le décalage qui garde l'entrée éclairée au milieu de la liste visible, sans dépasser ses bords. */
function listOffset(index: number, count: number): number {
  const content = count * PITCH - GAP;
  if (index < 0 || content <= LIST_MAX) return 0;
  const centered = index * PITCH - (LIST_MAX - N.itemHeight) / 2;
  return Math.min(Math.max(0, centered), content - LIST_MAX);
}

export const RailPreview = memo(function RailPreview({ caption, entries, focusedKey, movingKey }: {
  caption: string;
  /** Rechercher en tête, puis Accueil et ce qui sera affiché. */
  entries: RailPreviewEntry[];
  /** La bibliothèque que le focus vise dans la liste : éclairée ici. */
  focusedKey: string | null;
  movingKey: string | null;
}) {
  const [search, ...list] = entries;
  const lit = movingKey ?? focusedKey;
  const offset = listOffset(list.findIndex((entry) => entry.key === lit), list.length);
  const scroll = useSharedValue(offset);
  useEffect(() => {
    scroll.value = MOTION_ENABLED ? withTiming(offset, { duration: SCROLL_MS, easing: EASE.out }) : offset;
  }, [offset, scroll]);
  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -scroll.value }] }));
  const visible = Math.min(LIST_MAX, list.length * PITCH - GAP);

  return (
    <View style={styles.column} pointerEvents="none">
      <Text style={styles.caption}>{caption}</Text>
      <GlassSurface radius={N.radius} tone="regular" style={styles.capsule}>
        {search ? <PreviewItem entry={search} /> : null}
        <View style={styles.separator} />
        <View style={[styles.window, { height: Math.max(visible, 0) }]}>
          <Animated.View style={listStyle}>
            {list.map((entry) => (
              <PreviewItem
                key={entry.key}
                entry={entry}
                active={entry.key === RAIL_HOME_KEY}
                lit={entry.key === focusedKey && movingKey === null}
                moving={entry.key === movingKey}
              />
            ))}
          </Animated.View>
        </View>
      </GlassSurface>
    </View>
  );
});

function PreviewItem({ entry, active, lit, moving }: { entry: RailPreviewEntry; active?: boolean; lit?: boolean; moving?: boolean }) {
  const color = active || lit || moving ? colors.text : colors.textSecondary;
  return (
    <Animated.View entering={MOTION_ENABLED ? FadeIn.duration(220) : undefined} style={styles.item}>
      {active ? <View style={[StyleSheet.absoluteFill, styles.active]} /> : null}
      {lit ? <View style={[StyleSheet.absoluteFill, styles.lit]} /> : null}
      {moving ? <View style={[StyleSheet.absoluteFill, styles.moving]} /> : null}
      <Icon name={moving ? "moveVertical" : entry.icon} size={N.icon} color={color} strokeWidth={2.2} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {entry.label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // La colonne de la vraie barre : son bord gauche, sa largeur ouverte, centrée en hauteur.
  column: { position: "absolute", left: N.left, top: 0, bottom: 0, width: WIDTH, justifyContent: "center" },
  caption: { ...text.kicker, marginLeft: INSET + 8, marginBottom: 20 },
  capsule: { width: WIDTH, padding: INSET, overflow: "hidden" },
  separator: { height: 1, marginVertical: 12, marginHorizontal: 16, backgroundColor: white(0.12) },
  window: { overflow: "hidden" },
  item: {
    height: N.itemHeight,
    marginBottom: GAP,
    borderRadius: N.itemRadius,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: (N.itemHeight - N.icon) / 2,
  },
  active: { borderRadius: N.itemRadius, backgroundColor: white(0.14) },
  lit: { borderRadius: N.itemRadius, backgroundColor: white(0.08) },
  moving: { borderRadius: N.itemRadius, borderWidth: 2, borderColor: colors.accent, backgroundColor: white(0.08) },
  label: { ...fonts.semibold, fontSize: 26, flex: 1 },
});
