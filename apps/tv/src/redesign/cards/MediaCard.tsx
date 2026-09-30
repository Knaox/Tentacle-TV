import { memo, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { colors, fonts, scrim } from "../theme/tokens";
import { CardFrame } from "./CardFrame";
import { CardMarkerLayer } from "./CardMarkerLayer";
import type { CardModel } from "./cardTypes";

/**
 * La carte d'un titre — deux formats, un seul modèle :
 * - `landscape` (16:9) : image Thumb/Backdrop, logo du titre posé dessus
 *   quand l'image n'en porte pas ; légende dessous ;
 * - `poster` (2:3) : l'affiche ; légende dessous.
 * Rien au centre de l'image : OK fait déjà l'action principale, l'appui long
 * ouvre la feuille.
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
  return (
    <FocusTarget
      focusKey={focusKey}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocusChange={onFocusChange}
      accessibilityLabel={card.title}
      style={{ width }}
    >
      {(focused) => (
        <View>
          <CardFrame width={width} height={height} radius={radius} focused={focused} dimmed={dimmed} origin={origin}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
            ) : (
              <View style={styles.missing}>
                <Text style={styles.missingTitle} numberOfLines={3}>{card.title}</Text>
              </View>
            )}
            {landscape && card.logoUri ? (
              <>
                <LinearGradient colors={[scrim(0), scrim(0.55)]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
                <Image source={{ uri: card.logoUri }} style={styles.logo} resizeMode="contain" fadeDuration={0} />
              </>
            ) : null}
            {card.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{card.badge}</Text>
              </View>
            ) : null}
            <CardMarkerLayer markers={card.markers} progress={card.progress} compact={!landscape} />
          </CardFrame>
          {hideCaption ? null : (
            <Caption focused={focused} shift={captionShift(height, origin)}>
              <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={1}>{card.title}</Text>
              {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
            </Caption>
          )}
        </View>
      )}
    </FocusTarget>
  );
});

const styles = StyleSheet.create({
  missing: { flex: 1, padding: 22, justifyContent: "flex-end", backgroundColor: colors.surface3 },
  missingTitle: { ...fonts.bold, fontSize: 26, lineHeight: 30, color: colors.textSecondary },
  logo: { position: "absolute", left: 22, right: 90, bottom: 22, height: 64 },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  badgeText: { ...fonts.extrabold, fontSize: 22, color: colors.onAccent },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
