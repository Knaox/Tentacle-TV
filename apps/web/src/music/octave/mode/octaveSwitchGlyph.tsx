/**
 * Octave — ce que porte le pouce de la bascule : UN SEUL point d'import, le
 * LOGO d'Octave en couleur (la mascotte et son tricorne, généré par
 * `brand/octave.py`), dans sa petite taille (sous 24 px : le tricorne cerné,
 * lisible à 16 px). Le même dans les deux états : la piste dit allumé ou
 * éteint ; le pouce dit « Octave, c'est Tentacle ».
 */

import { memo } from "react";
import { octaveLogoDataUri } from "../../../components/ui/octaveLogo.generated";

export const OctaveSwitchGlyph = memo(function OctaveSwitchGlyph({ size }: { size: number }) {
  return (
    <img
      src={octaveLogoDataUri("color", size)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className="pointer-events-none shrink-0 select-none"
      data-octave-switch-logo
    />
  );
});
