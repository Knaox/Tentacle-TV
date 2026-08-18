import Svg, { Circle, Path } from "react-native-svg";

/**
 * Icônes propres à la navigation, hors de `TVIcons.tsx` — celui-ci atteint la
 * limite de trois cents lignes du dépôt.
 *
 * Même dessin et mêmes proportions que les autres : trait de 2, extrémités
 * arrondies, grille de 24.
 */

const COULEUR = "#c4b5fd";
const TAILLE = 24;

interface IconProps {
  size?: number;
  color?: string;
}

/** L'œil de « Tout afficher » : rend au rail les entrées qu'on y avait cachées. */
export function EyeIcon({ size = TAILLE, color = COULEUR }: IconProps) {
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
