/**
 * Octave — le logo (la mascotte qui tient une note), tiré du module GÉNÉRÉ par
 * `brand/octave.py` (jamais redessiné ici) : vitre selon le thème, sans
 * chapeau sous 24 px (le module en décide).
 */

import { memo } from "react";
import { octaveLogoDataUri } from "../../../components/ui/octaveLogo.generated";
import { useThemeMode } from "../../../theme/useThemeMode";

export const OctaveLogo = memo(function OctaveLogo({ size, mono = false, className = "" }: { size: number; mono?: boolean; className?: string }) {
  const { isDark } = useThemeMode();
  return (
    <img
      src={octaveLogoDataUri(mono ? "mono" : "color", size, isDark)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={`shrink-0 select-none ${className}`}
    />
  );
});
