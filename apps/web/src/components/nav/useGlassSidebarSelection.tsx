import { motion, useReducedMotion } from "framer-motion";
import { useMemo, type ReactNode } from "react";

import { useWindowGlass } from "../../desktop/windowGlass";
import { glassMorphProps } from "../../theme/glass";

/**
 * Rayon de la sélection, en px : `--lg-radius-sm` du matériau. En nombre et
 * en `style`, sinon framer ne le corrige pas pendant l'étirement.
 */
const SELECTION_RADIUS = 12;

/**
 * La sélection en verre de la barre latérale (`SettingsShell` :
 * `selectionIndicator`) : une lentille teintée de la marque qui GLISSE d'une
 * entrée à l'autre sur le ressort de métamorphose, comme la barre latérale des
 * Réglages Système de macOS 26.
 *
 * Mode natif seulement (`useWindowGlass`) ; ailleurs `undefined`, et la
 * barre garde sa sélection d'avant. `id` distingue les barres (réglages,
 * administration) : une sélection ne vole jamais d'une page à l'autre.
 */
export function useGlassSidebarSelection(id: string): ReactNode {
  const glass = useWindowGlass();
  const reduced = useReducedMotion() ?? false;
  return useMemo(() => {
    if (!glass) return undefined;
    const morph = glassMorphProps(`sidebar-${id}`, reduced);
    return (
      <motion.span
        aria-hidden
        layoutId={morph.layoutId}
        transition={morph.transition}
        className="lgc-sidebar-selection absolute inset-0"
        style={{ borderRadius: SELECTION_RADIUS }}
      />
    );
  }, [glass, reduced, id]);
}
