import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import type { RowPlace } from "../motion/useRowRecede";
import { Icon } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";
import { CardBadge } from "./CardBadge";
import { CardFrame } from "./CardFrame";
import { CardMarkerLayer } from "./CardMarkerLayer";
import type { CardModel } from "./cardTypes";
import { useCardFocused } from "./useCardFocused";

/**
 * La carte qui se redresse : 16:9 au repos (l'image large de l'œuvre), son
 * AFFICHE 2:3 au focus. Rien ne se recalcule dans la mise en page : la place
 * de la carte reste celle de la vignette, et l'affiche — posée par-dessus,
 * centrée, plus haute — entre en fondu pendant que la vignette s'efface.
 * Seuls `opacity` et `transform` s'animent.
 *
 * L'affiche déborde de sa place, un peu en haut (`MORPH_OVERFLOW`, que la
 * rangée garde dégagé), surtout en bas, sur la légende qui s'efface ; la
 * carte focalisée passe devant ses voisines.
 *
 * Aucune action sur la carte : l'affiche garde ses marqueurs, l'appui
 * maintenu ouvre le grand panneau des actions. La carte elle-même est un
 * `FocusTarget` sans rendu, à la place de la vignette, posé AU-DESSUS des
 * deux faces : tvOS ne propose pas un focalisable recouvert par ce qui
 * dessine.
 *
 * `badge` (« Découverte ») se pose sur les deux faces ; `focusNote` — la
 * raison d'une recommandation — paraît sous l'affiche au focus, et la rangée
 * qui en porte garde `MORPH_NOTE_SPACE` de plus dessous.
 */

const L = TV_STAGE.card.landscape;
const POSTER_H = 330;
const POSTER_W = 220;
/** Ce que l'agrandissement du focus ajoute à l'affiche, en haut comme en bas. */
const GROWTH = Math.round((POSTER_H * (TV_STAGE.focus.cardScale - 1)) / 2);
/**
 * Ce que l'affiche agrandie dépasse de la vignette, EN HAUT : moins que
 * l'écart sous le titre de la rangée. L'affiche descend — elle prend la place
 * de la légende, qui s'efface —, elle ne monte jamais sur le titre.
 */
export const MORPH_OVERFLOW = 22;
const POSTER_TOP = GROWTH - MORPH_OVERFLOW;
/** La phrase du focus (`focusNote`) : sous l'affiche agrandie. */
const NOTE_TOP = POSTER_TOP + POSTER_H + GROWTH + 12;
/** La place qu'une rangée garde en plus, dessous, quand ses cartes ont une
 *  phrase de focus (deux lignes sous l'affiche). */
export const MORPH_NOTE_SPACE = 76;
const NO_VISUAL = () => null;

export interface MorphCardProps {
  card: CardModel;
  /** Sa place dans une rangée : la vignette recule quand une voisine a le focus. */
  place?: RowPlace;
  focusKey?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export const MorphCard = memo(function MorphCard({ card, place, focusKey, onPress, onLongPress, onFocusChange }: MorphCardProps) {
  const { focused, onTargetFocusChange } = useCardFocused(focusKey, onFocusChange);
  // L'appui, tenu par la cible, lu par l'affiche.
  const press = useSharedValue(0);
  return (
    <View style={[styles.cell, focused && styles.front]}>
      <Body card={card} place={place} focused={focused} press={press} />
      <FocusTarget
        focusKey={focusKey}
        onPress={onPress}
        onLongPress={onLongPress}
        onFocusChange={onTargetFocusChange}
        accessibilityLabel={card.title}
        style={styles.hit}
        pressProgress={press}
      >
        {NO_VISUAL}
      </FocusTarget>
    </View>
  );
});

function Body({ card, place, focused, press }: { card: CardModel; place?: RowPlace; focused: boolean; press: SharedValue<number> }) {
  const p = useFocusProgress(focused, 260);
  const landscapeFade = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const posterIn = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.86 + 0.14 * p.value }] }));
  const captionFade = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const noteIn = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: 8 * (1 - p.value) }] }));
  const landscapeUri = card.landscapeUri ?? card.posterUri;
  return (
    <>
      <Animated.View style={landscapeFade}>
        <CardFrame width={L.width} height={L.height} radius={L.radius} focused={false} place={place}>
          {landscapeUri ? <Image source={{ uri: landscapeUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
          {card.logoUri ? <Image source={{ uri: card.logoUri }} style={styles.logo} resizeMode="contain" fadeDuration={0} /> : null}
          {card.badge ? <CardBadge label={card.badge} /> : null}
          <CardMarkerLayer markers={card.markers} progress={card.progress} />
        </CardFrame>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.poster, posterIn]}>
        <CardFrame width={POSTER_W} height={POSTER_H} radius={TV_STAGE.card.poster.radius} focused={focused} press={press} origin="center">
          {card.posterUri ? (
            <Image source={{ uri: card.posterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : landscapeUri ? (
            <Image source={{ uri: landscapeUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : null}
          {card.badge ? <CardBadge label={card.badge} compact /> : null}
          <CardMarkerLayer markers={card.markers} progress={card.progress} compact />
        </CardFrame>
      </Animated.View>
      <Animated.View style={[styles.caption, captionFade]}>
        <Text style={styles.title} numberOfLines={1}>{card.title}</Text>
        {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
      </Animated.View>
      {card.focusNote ? (
        <Animated.View pointerEvents="none" style={[styles.note, noteIn]}>
          <View style={styles.noteRow}>
            <Icon name="sparkles" size={20} color={colors.accentLight} />
            <Text style={styles.noteText} numberOfLines={2}>{card.focusNote}</Text>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cell: { width: L.width },
  front: { zIndex: 10 },
  // La place de repos de la carte : la vignette — pas l'affiche qui en déborde.
  hit: { position: "absolute", top: 0, left: 0, width: L.width, height: L.height },
  poster: {
    position: "absolute",
    top: POSTER_TOP,
    left: (L.width - POSTER_W) / 2,
    width: POSTER_W,
    height: POSTER_H,
  },
  logo: { position: "absolute", left: 22, right: 90, bottom: 22, height: 64 },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
  note: { position: "absolute", top: NOTE_TOP, left: -10, right: -10, alignItems: "center" },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noteText: { ...fonts.semibold, fontSize: 22, lineHeight: 28, color: colors.text, flexShrink: 1 },
});
