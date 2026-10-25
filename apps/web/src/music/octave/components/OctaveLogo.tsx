/**
 * Octave — le logo, tiré du module GÉNÉRÉ par `brand/octave.py` (jamais
 * redessiné ici) : la mascotte sans chapeau, la note sur son écran, à partir
 * de 24 px ; le glyphe au dégradé en dessous (le module en décide). En
 * monochrome, toujours le glyphe, rendu en ligne à `currentColor` comme une
 * icône posée à côté.
 */

import { memo } from "react";
import { OctaveGlyph } from "../../../components/ui/OctaveGlyph";
import { octaveLogoDataUri } from "../../../components/ui/octaveLogo.generated";

export const OctaveLogo = memo(function OctaveLogo({ size, mono = false, className = "" }: { size: number; mono?: boolean; className?: string }) {
  if (mono) return <OctaveGlyph size={size} className={`select-none ${className}`} />;
  return (
    <img
      src={octaveLogoDataUri("color", size)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={`shrink-0 select-none ${className}`}
    />
  );
});
