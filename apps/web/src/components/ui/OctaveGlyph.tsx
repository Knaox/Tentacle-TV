/**
 * Le glyphe d'Octave — la croche dont le crochet est un bras de la mascotte —,
 * pour l'interface : bascule vers le mode musique, onglet, navigation (16 → 24 px).
 * Tiré du module GÉNÉRÉ par `brand/octave.py`, jamais redessiné ici.
 *
 * Une seule couleur : il prend `currentColor`, comme une icône Lucide posée à
 * côté (thème clair ou sombre, verre, état actif : la couleur du texte décide).
 * Décoratif par défaut ; avec `label`, il devient une image nommée.
 */

import { memo } from "react";
import { OCTAVE_GLYPH_PATHS, OCTAVE_GLYPH_VIEWBOX } from "./octaveLogo.generated";

interface OctaveGlyphProps {
  /** Côté en pixels (défaut 20, la taille des icônes de la barre). */
  size?: number;
  className?: string;
  /** Nom lu par les lecteurs d'écran ; absent, le glyphe est masqué (décoratif). */
  label?: string;
}

export const OctaveGlyph = memo(function OctaveGlyph({ size = 20, className = "", label }: OctaveGlyphProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      viewBox={OCTAVE_GLYPH_VIEWBOX}
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...a11y}
    >
      {OCTAVE_GLYPH_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
});
