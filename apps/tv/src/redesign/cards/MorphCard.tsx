import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { colors, fonts } from "../theme/tokens";
import { CardFrame } from "./CardFrame";
import { CardMarkerLayer } from "./CardMarkerLayer";
import type { CardModel } from "./cardTypes";

/**
 * La carte qui se redresse : 16:9 au repos (l'image large de l'œuvre), son
 * AFFICHE 2:3 au focus. Rien ne se recalcule dans la mise en page : la place
 * de la carte reste celle de la vignette, et l'affiche — posée par-dessus,
 * centrée, plus haute — entre en fondu pendant que la vignette s'efface.
 * Seuls `opacity` et `transform` s'animent.
 *
 * L'affiche déborde de sa place en haut et en bas : la rangée garde le
 * dégagement nécessaire (`MORPH_OVERFLOW`), et la carte focalisée passe
 * devant ses voisines.
 */

const L = TV_STAGE.card.landscape;
const POSTER_H = 330;
const POSTER_W = 220;
/** Ce que l'affiche dépasse de la vignette, en haut. */
export const MORPH_OVERFLOW = Math.round((POSTER_H - L.height) / 2);

export interface MorphCardProps {
  card: CardModel;
  dimmed?: boolean;
  focusKey?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export const MorphCard = memo(function MorphCard({ card, dimmed, focusKey, onPress, onLongPress, onFocusChange }: MorphCardProps) {
  return (
    <FocusTarget
      focusKey={focusKey}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocusChange={onFocusChange}
      accessibilityLabel={card.title}
      style={[styles.cell, { zIndex: 0 }]}
    >
      {(focused) => <Body card={card} dimmed={dimmed} focused={focused} />}
    </FocusTarget>
  );
});

function Body({ card, dimmed, focused }: { card: CardModel; dimmed?: boolean; focused: boolean }) {
  const p = useFocusProgress(focused, 260);
  const landscapeFade = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const posterIn = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.86 + 0.14 * p.value }] }));
  const captionFade = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const landscapeUri = card.landscapeUri ?? card.posterUri;
  return (
    <View style={[styles.cell, focused && styles.front]}>
      <Animated.View style={landscapeFade}>
        <CardFrame width={L.width} height={L.height} radius={L.radius} focused={false} dimmed={dimmed}>
          {landscapeUri ? <Image source={{ uri: landscapeUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
          {card.logoUri ? <Image source={{ uri: card.logoUri }} style={styles.logo} resizeMode="contain" fadeDuration={0} /> : null}
          <CardMarkerLayer markers={card.markers} progress={card.progress} />
        </CardFrame>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.poster, posterIn]}>
        <CardFrame width={POSTER_W} height={POSTER_H} radius={TV_STAGE.card.poster.radius} focused={focused} origin="center">
          {card.posterUri ? (
            <Image source={{ uri: card.posterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : landscapeUri ? (
            <Image source={{ uri: landscapeUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : null}
          <CardMarkerLayer markers={card.markers} progress={card.progress} compact />
        </CardFrame>
      </Animated.View>
      <Animated.View style={[styles.caption, captionFade]}>
        <Text style={styles.title} numberOfLines={1}>{card.title}</Text>
        {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { width: L.width },
  front: { zIndex: 10 },
  poster: {
    position: "absolute",
    top: -MORPH_OVERFLOW,
    left: (L.width - POSTER_W) / 2,
    width: POSTER_W,
    height: POSTER_H,
  },
  logo: { position: "absolute", left: 22, right: 90, bottom: 22, height: 64 },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
