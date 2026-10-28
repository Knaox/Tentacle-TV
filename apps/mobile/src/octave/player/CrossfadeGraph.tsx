/**
 * Octave (mobile) — le DESSIN de la transition douce : le titre qui part (violet) s'efface pendant que le
 * suivant (rose) arrive, à puissance constante ; la largeur du chevauchement suit la durée choisie. Coupée :
 * deux marches qui se touchent. Chemins tirés du partagé (`crossfadeShape`), les mêmes que sur le web.
 */

import { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { crossfadeShape } from "@tentacle-tv/shared/octave";
import { useOctaveColors } from "../theme/octaveColors";

interface Props {
  ms: number;
  width: number;
  height: number;
}

export const CrossfadeGraph = memo(function CrossfadeGraph({ ms, width, height }: Props) {
  const colors = useOctaveColors();
  const shape = useMemo(() => crossfadeShape(ms, width, height), [ms, width, height]);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="out" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.gradient[0]} stopOpacity={0.9} />
            <Stop offset="1" stopColor={colors.gradient[0]} stopOpacity={0.15} />
          </LinearGradient>
          <LinearGradient id="in" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.gradient[2]} stopOpacity={0.9} />
            <Stop offset="1" stopColor={colors.gradient[1]} stopOpacity={0.15} />
          </LinearGradient>
        </Defs>
        <Path d={shape.outgoing} fill="url(#out)" />
        <Path d={shape.incoming} fill="url(#in)" />
      </Svg>
    </View>
  );
});
