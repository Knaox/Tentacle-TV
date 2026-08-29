import Svg, { Circle, Path } from "react-native-svg";
import { Colors } from "../../theme/colors";

/**
 * Icônes propres à la navigation, hors de `TVIcons.tsx` — celui-ci atteint la
 * limite de trois cents lignes du dépôt.
 *
 * Même dessin et mêmes proportions que les autres : trait de 2, extrémités
 * arrondies, grille de 24.
 */

const COLOR = Colors.accentPurpleLight;
const SIZE = 24;

interface IconProps {
  size?: number;
  color?: string;
}

/** L'œil de « Tout afficher » : rend au rail les entrées qu'on y avait cachées. */
export function EyeIcon({ size = SIZE, color = COLOR }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}

/** Le cœur des Favoris, au trait du rail (2, extrémités rondes). */
export function HeartNavIcon({ size = SIZE, color = COLOR }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Svg>
  );
}
