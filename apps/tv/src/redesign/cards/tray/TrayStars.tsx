import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { STAR_PATH, STAR_VIEWBOX } from "@tentacle-tv/shared";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { colors, white } from "../../theme/tokens";
import { trayFocusKey } from "../cardFocusKeys";
import type { CardTrayRating } from "../cardTypes";

/**
 * La note au plateau : cinq étoiles focalisables, ENTIÈRES (une étoile = 2 sur
 * 10) — la feuille (`SheetRating`) à la taille d'une carte. La télécommande
 * n'a pas de demi-étoile à viser ; une note en demi-étoile posée ailleurs
 * s'affiche telle quelle.
 *
 * L'étoile visée prévisualise la note ; visée SUR la note actuelle, elle la
 * retire : les étoiles pâlissent. Ce que fera OK s'écrit dans la bulle du
 * plateau (`TrayHint`). Tant que la cible se résout (la série d'un épisode),
 * la place est gardée : le plateau ne saute pas quand les étoiles arrivent.
 */

const STARS = [1, 2, 3, 4, 5] as const;
const FOCUS_SCALE = 1.18;

/** Le remplissage d'une étoile pour une note sur 10 : 0, ½ ou 1. */
function fractionOf(score: number, star: number): number {
  return Math.min(Math.max(score - (star - 1) * 2, 0), 2) / 2;
}

export interface TrayStarsProps {
  rating: CardTrayRating;
  size: number;
  /** L'étoile qui porte le focus (1 à 5), ou null. */
  focusedStar: number | null;
  cardKey?: string;
  onRate?: (stars: number) => void;
  onFocusChange: (id: string, focused: boolean) => void;
}

export const TrayStars = memo(function TrayStars({ rating, size, focusedStar, cardKey, onRate, onFocusChange }: TrayStarsProps) {
  const { t } = useTranslation("reco");
  if (rating.pending) return <View style={{ height: size }} />;
  const { current } = rating;
  const removing = focusedStar !== null && current === focusedStar * 2;
  const shown = focusedStar !== null ? focusedStar * 2 : current ?? 0;
  return (
    <View style={styles.row}>
      {STARS.map((n) => (
        <FocusTarget
          key={n}
          focusKey={trayFocusKey(cardKey, `star:${n}`)}
          onPress={onRate ? () => onRate(n) : undefined}
          onFocusChange={(focused) => onFocusChange(`star:${n}`, focused)}
          accessibilityLabel={current === n * 2 ? t("removeRatingAria", { score: current }) : t("rateAria", { score: n * 2 })}
        >
          {(focused) => <StarCell id={n} size={size} fraction={fractionOf(shown, n)} dim={removing} focused={focused} />}
        </FocusTarget>
      ))}
    </View>
  );
});

function StarCell({ id, size, fraction, dim, focused }: { id: number; size: number; fraction: number; dim: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (FOCUS_SCALE - 1) * p.value }] }));
  const disc = useAnimatedStyle(() => ({ opacity: p.value }));
  const star = Math.round(size * 0.68);
  const clipId = `tray-star-${id}`;
  return (
    <Animated.View style={[styles.cell, { width: size, height: size }, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.disc, { borderRadius: size / 2 }, disc]} />
      {/* Le plein est rogné DANS le SVG : une vue `overflow: hidden` autour
          d'un SVG ne le rogne pas partout. */}
      <Svg width={star} height={star} viewBox={STAR_VIEWBOX} style={dim ? styles.dim : undefined}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={0} y={0} width={20 * fraction} height={20} />
          </ClipPath>
        </Defs>
        <Path d={STAR_PATH} fill="none" stroke={white(0.72)} strokeWidth={1.3} strokeLinejoin="round" />
        {fraction > 0 ? <Path d={STAR_PATH} fill={colors.accentLight} clipPath={`url(#${clipId})`} /> : null}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  cell: { alignItems: "center", justifyContent: "center" },
  disc: { backgroundColor: white(0.2) },
  dim: { opacity: 0.4 },
});
