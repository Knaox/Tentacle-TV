/**
 * Octave — le glyphe du pouce de la bascule : UN SEUL point d'import. Le logo
 * d'Octave redessiné (lot « Octave UI », axe O1) le remplace ici, et nulle
 * part ailleurs. Posé sur un pouce CLAIR dans les deux thèmes : l'encre.
 */

import { memo } from "react";
import { octaveLogoDataUri } from "../../../components/ui/octaveLogo.generated";

export const OctaveSwitchGlyph = memo(function OctaveSwitchGlyph({ size }: { size: number }) {
  return (
    <img
      src={octaveLogoDataUri("mono", size, false)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className="pointer-events-none select-none"
    />
  );
});
