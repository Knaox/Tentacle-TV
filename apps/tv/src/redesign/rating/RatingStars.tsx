import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { STAR_PATH, STAR_VIEWBOX } from "@tentacle-tv/shared";
import { colors, white } from "../theme/tokens";

/**
 * Une note en cinq étoiles, DEMI-étoiles comprises — les valeurs du bureau
 * (1 à 10, une étoile = 2). Brique d'affichage, jamais focalisable : l'échelle
 * de la feuille, la note du plateau et tout ce qui montre une note la
 * dessinent ici. Le plein est rogné DANS le SVG (une vue `overflow: hidden`
 * autour d'un SVG ne le rogne pas partout), au rose de la marque.
 */

const STARS = [1, 2, 3, 4, 5] as const;

/** Le remplissage d'une étoile pour une note sur 10 : 0, ½ ou 1. */
export function starFraction(score: number, star: number): number {
  return Math.min(Math.max(score - (star - 1) * 2, 0), 2) / 2;
}

export const RatingStars = memo(function RatingStars({
  score,
  size,
  gap = 2,
  fill = colors.accent,
  outline = white(0.55),
  dim = false,
}: {
  /** La note, sur 10 ; 0 : cinq étoiles vides. */
  score: number;
  size: number;
  gap?: number;
  fill?: string;
  outline?: string;
  /** Une note qu'on s'apprête à retirer : les étoiles pâlissent. */
  dim?: boolean;
}) {
  return (
    <View style={[styles.row, { gap }, dim && styles.dim]}>
      {STARS.map((star) => {
        const fraction = starFraction(score, star);
        const clipId = `rating-star-${star}`;
        return (
          <Svg key={star} width={size} height={size} viewBox={STAR_VIEWBOX}>
            <Defs>
              <ClipPath id={clipId}>
                <Rect x={0} y={0} width={20 * fraction} height={20} />
              </ClipPath>
            </Defs>
            <Path d={STAR_PATH} fill="none" stroke={outline} strokeWidth={1.2} strokeLinejoin="round" />
            {fraction > 0 ? <Path d={STAR_PATH} fill={fill} clipPath={`url(#${clipId})`} /> : null}
          </Svg>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  dim: { opacity: 0.35 },
});
