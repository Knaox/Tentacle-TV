import { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import LinearGradient, { type LinearGradientProps } from "react-native-linear-gradient";

/**
 * Un dégradé dessiné PETIT, puis agrandi par le GPU. `react-native-linear-
 * gradient` peint son dégradé sur le PROCESSEUR, à la taille de sa vue, à
 * chaque montage : un voile plein cadre, c'est deux millions de pixels
 * calculés sur le fil principal — huit sur une Apple TV 4K (échelle 2) —, le
 * gros du coût d'arrivée d'une fiche (mesuré : un tiers de son montage).
 *
 * Un dégradé est lisse : dessiné au huitième et agrandi (filtrage
 * bilinéaire), il ne se distingue pas de l'original. Sur l'axe où il ne
 * varie pas (un voile vertical ne change pas de gauche à droite), il tient
 * en quatre pixels.
 *
 * `width` × `height` : la surface couverte, connue (la scène, le cadre d'une
 * carte) ; posé en absolu dans son parent, comme un `absoluteFill`.
 */

export interface SoftGradientProps extends Pick<LinearGradientProps, "colors" | "locations" | "start" | "end"> {
  width: number;
  height: number;
  /** L'échelle du dessin sur l'axe où le dégradé varie (un huitième par défaut). */
  resolution?: number;
  style?: StyleProp<ViewStyle>;
}

/** La scène de la refonte, en points : la surface d'un voile plein cadre. */
export const STAGE_SIZE = { width: 1920, height: 1080 } as const;

/** Les pixels d'un axe le long duquel rien ne change. */
const FLAT = 4;
const DOWN = { x: 0.5, y: 0 };
const BOTTOM = { x: 0.5, y: 1 };

export const SoftGradient = memo(function SoftGradient({
  width,
  height,
  resolution = 1 / 8,
  style,
  start = DOWN,
  end = BOTTOM,
  ...gradient
}: SoftGradientProps) {
  const w = start.x === end.x ? FLAT : Math.max(FLAT, Math.ceil(width * resolution));
  const h = start.y === end.y ? FLAT : Math.max(FLAT, Math.ceil(height * resolution));
  const drawing = {
    position: "absolute" as const,
    left: (width - w) / 2,
    top: (height - h) / 2,
    width: w,
    height: h,
    transform: [{ scaleX: width / w }, { scaleY: height / h }],
  };
  return (
    <View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width, height }, style]}>
      <LinearGradient {...gradient} start={start} end={end} style={drawing} />
    </View>
  );
});
