import { memo, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { colors, fonts, scrim } from "../theme/tokens";
import { CardBadge } from "./CardBadge";
import { CardFocusNote } from "./CardFocusNote";
import { CardFrame } from "./CardFrame";
import { CardHoldHint } from "./CardHoldHint";
import { CardMarkerLayer } from "./CardMarkerLayer";
import type { CardModel } from "./cardTypes";
import { useCardFocused } from "./useCardFocused";

/**
 * La carte d'un titre — deux formats, un seul modèle :
 * - `landscape` (16:9) : image Thumb/Backdrop, logo du titre posé dessus
 *   quand l'image n'en porte pas ; légende dessous ;
 * - `poster` (2:3) : l'affiche ; légende dessous.
 * Rien au centre de l'image, et aucune action SUR la carte : OK fait l'action
 * principale (la fiche d'une affiche, la lecture d'une vignette), l'appui
 * maintenu ouvre le grand panneau des actions. Au focus, la carte grandit et
 * garde ses marqueurs — la note, l'épingle Ma liste · j'aime · vu, la
 * progression.
 *
 * Une vignette qui s'ouvre par l'appui maintenu (`onLongPress`) le dit sous
 * sa légende, au focus : « Maintenir OK : plus d'options » (`CardHoldHint`) —
 * OK y lit, rien d'autre ne l'apprendrait. Une affiche qui a une phrase de
 * focus (`card.focusNote`, la raison d'une recommandation) la montre au même
 * endroit (`CardFocusNote`).
 *
 * Deux étages, de bas en haut : l'image (`CardFrame`, qui ne fait que
 * dessiner), puis la carte elle-même — un `FocusTarget` sans rendu, à sa
 * place de repos : tvOS ne propose pas au focus un élément RECOUVERT par ce
 * qui dessine. `onFocusChange` dit le focus de la carte (`useCardFocused`).
 */

export interface MediaCardProps {
  card: CardModel;
  variant: "landscape" | "poster";
  /** Largeur ; la hauteur suit le format. */
  width?: number;
  dimmed?: boolean;
  focusKey?: string;
  origin?: "top" | "center";
  /** Cacher la légende (grilles denses, rangées d'épisodes qui portent la leur). */
  hideCaption?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const DEFAULT_WIDTH = { landscape: TV_STAGE.card.landscape.width, poster: TV_STAGE.card.poster.width };
const NO_VISUAL = () => null;

/** Ce que le pied de l'image descend quand elle grandit (et se soulève de 4) :
 *  la légende descend d'autant, l'image ne la recouvre jamais. */
function captionShift(height: number, origin: "top" | "center" = "top"): number {
  const growth = height * (TV_STAGE.focus.cardScale - 1);
  return origin === "center" ? growth / 2 : growth - 4;
}

function Caption({ focused, shift, children }: { focused: boolean; shift: number; children: ReactNode }) {
  const p = useFocusProgress(focused);
  const follow = useAnimatedStyle(() => ({ transform: [{ translateY: shift * p.value }] }));
  return <Animated.View style={[styles.caption, follow]}>{children}</Animated.View>;
}

/** Le logo d'une vignette, sur son dégradé. */
function LogoLayer({ uri }: { uri: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[scrim(0), scrim(0.55)]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <Image source={{ uri }} style={styles.logo} resizeMode="contain" fadeDuration={0} />
    </View>
  );
}

export const MediaCard = memo(function MediaCard({
  card,
  variant,
  width = DEFAULT_WIDTH[variant],
  dimmed,
  focusKey,
  origin,
  hideCaption = false,
  onPress,
  onLongPress,
  onFocusChange,
}: MediaCardProps) {
  const landscape = variant === "landscape";
  const height = Math.round(landscape ? (width * 9) / 16 : width * 1.5);
  const radius = landscape ? TV_STAGE.card.landscape.radius : TV_STAGE.card.poster.radius;
  const uri = landscape ? card.landscapeUri ?? card.posterUri : card.posterUri ?? card.landscapeUri;
  const { focused, onTargetFocusChange } = useCardFocused(focusKey, onFocusChange);
  const holdHint = landscape && onLongPress !== undefined && focused;
  const note = !holdHint && focused ? card.focusNote : undefined;
  return (
    <View style={[{ width }, focused && styles.front]}>
      <CardFrame width={width} height={height} radius={radius} focused={focused} dimmed={dimmed} origin={origin}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        ) : (
          <View style={styles.missing}>
            <Text style={styles.missingTitle} numberOfLines={3}>{card.title}</Text>
          </View>
        )}
        {landscape && card.logoUri ? <LogoLayer uri={card.logoUri} /> : null}
        {card.badge ? <CardBadge label={card.badge} /> : null}
        <CardMarkerLayer markers={card.markers} progress={card.progress} compact={!landscape} />
      </CardFrame>
      <FocusTarget
        focusKey={focusKey}
        onPress={onPress}
        onLongPress={onLongPress}
        onFocusChange={onTargetFocusChange}
        accessibilityLabel={card.title}
        style={[styles.hit, { width, height }]}
      >
        {NO_VISUAL}
      </FocusTarget>
      {hideCaption ? null : (
        <Caption focused={focused} shift={captionShift(height, origin)}>
          <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={1}>{card.title}</Text>
          {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
          {holdHint ? <CardHoldHint /> : null}
          {note ? <CardFocusNote text={note} width={Math.round(width * 1.6)} /> : null}
        </Caption>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  // La carte focalisée passe devant ses voisines : son ombre de soulèvement
  // n'est plus recouverte par la suivante.
  front: { zIndex: 10 },
  hit: { position: "absolute", top: 0, left: 0 },
  missing: { flex: 1, padding: 22, justifyContent: "flex-end", backgroundColor: colors.surface3 },
  missingTitle: { ...fonts.bold, fontSize: 26, lineHeight: 30, color: colors.textSecondary },
  logo: { position: "absolute", left: 22, right: 90, bottom: 22, height: 64 },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
