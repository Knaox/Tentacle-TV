import Svg, { Path } from "react-native-svg";

/**
 * Les deux glyphes propres à la feuille d'actions, au trait de 2 comme ceux
 * de `TVIcons` : « Ne plus me proposer » (l'œil barré du plateau web,
 * `EyeOff` de Lucide) et « Toutes les plateformes » (l'entonnoir barré,
 * `FilterX`). À part : `TVIcons.tsx` est au budget de 300 lignes.
 */

interface IconProps {
  size: number;
  color: string;
}

export function EyeOffIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <Path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <Path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <Path d="m2 2 20 20" />
    </Svg>
  );
}

export function FilterOffIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055" />
      <Path d="m22 3-5 5" />
      <Path d="m17 3 5 5" />
    </Svg>
  );
}
