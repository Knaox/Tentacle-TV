import { memo, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient } from "../background/SoftGradient";
import { useFocusProgress } from "../focus/useFocusProgress";
import type { RowPlace } from "../motion/useRowRecede";
import { colors, fonts, scrim } from "../theme/tokens";
import { CardBadge } from "./CardBadge";
import { CardFocusFooter } from "./CardFocusFooter";
import { CardFrame } from "./CardFrame";
import { CardShell } from "./CardShell";
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
 * Sous la légende, au focus (`CardFocusFooter`) : la phrase de focus d'une
 * carte qui en a une (`card.focusNote`, la raison d'une recommandation), puis
 * — toute carte qui s'ouvre par l'appui maintenu (`onLongPress`) —
 * « Maintenir OK : plus d'options » : rien d'autre ne l'apprendrait.
 *
 * L'ossature est celle de toute carte (`CardShell`) : la légende dessous,
 * puis la cible qui couvre image ET légende et ne porte que l'image — rien
 * ne la recouvre, et seule l'image suit le pouce (la parallaxe d'Apple TV).
 * `onFocusChange` dit le focus de la carte (`useCardFocused`).
 */

export interface MediaCardProps {
  card: CardModel;
  variant: "landscape" | "poster";
  /** Largeur ; la hauteur suit le format. */
  width?: number;
  /** Sa place dans une rangée : elle recule quand une voisine a le focus. */
  place?: RowPlace;
  /** Recule — hors d'une rangée à valeur partagée (`place` l'emporte). */
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
function LogoLayer({ uri, width, height }: { uri: string; width: number; height: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SoftGradient width={width} height={height} colors={[scrim(0), scrim(0.55)]} locations={[0.35, 1]} />
      <Image source={{ uri }} style={styles.logo} resizeMode="contain" fadeDuration={0} />
    </View>
  );
}

export const MediaCard = memo(function MediaCard({
  card,
  variant,
  width = DEFAULT_WIDTH[variant],
  place,
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
  return (
    <CardShell
      focusKey={focusKey}
      width={width}
      frameHeight={height}
      front={focused}
      onPress={onPress}
      onLongPress={onLongPress}
      onTargetFocusChange={onTargetFocusChange}
      accessibilityLabel={card.title}
      frame={
        <CardFrame width={width} height={height} radius={radius} focused={focused} place={place} dimmed={dimmed} origin={origin}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : (
            <View style={styles.missing}>
              <Text style={styles.missingTitle} numberOfLines={3}>{card.title}</Text>
            </View>
          )}
          {landscape && card.logoUri ? <LogoLayer uri={card.logoUri} width={width} height={height} /> : null}
          {card.badge ? <CardBadge label={card.badge} /> : null}
          <CardMarkerLayer markers={card.markers} progress={card.progress} compact={!landscape} />
        </CardFrame>
      }
    >
      {hideCaption ? null : (
        <Caption focused={focused} shift={captionShift(height, origin)}>
          <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={1}>{card.title}</Text>
          {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
          <CardFocusFooter
            note={focused ? card.focusNote : undefined}
            hold={focused && onLongPress !== undefined}
            width={Math.round(width * 1.6)}
          />
        </Caption>
      )}
    </CardShell>
  );
});

const styles = StyleSheet.create({
  missing: { flex: 1, padding: 22, justifyContent: "flex-end", backgroundColor: colors.surface3 },
  missingTitle: { ...fonts.bold, fontSize: 26, lineHeight: 30, color: colors.textSecondary },
  logo: { position: "absolute", left: 22, right: 90, bottom: 22, height: 64 },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
