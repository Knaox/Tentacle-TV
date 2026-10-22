import { motion, useReducedMotion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import type { SettingsShellSurface } from "@tentacle-tv/ui";

import { useWindowGlass } from "../../desktop/windowGlass";
import { glassMorphProps, useLiquidGlassSurface } from "../../theme/glass";

/**
 * Rayon de la sélection, en px : CONCENTRIQUE au rail — `--lg-radius-lg` (22)
 * moins sa marge (`--lg-chrome-sidebar-pad`, 8). En nombre et en `style`,
 * sinon framer ne le corrige pas pendant l'étirement.
 */
const SELECTION_RADIUS = 14;

export interface GlassSidebar {
  /** Posé dans l'entrée active (`SettingsShell` : `selectionIndicator`). */
  selection: ReactNode;
  /** Le rail en surface de verre (`SettingsShell` : `sidebarSurface`). */
  surface: SettingsShellSurface | undefined;
}

/**
 * La barre latérale en verre (`SettingsShell` : Réglages, Administration) :
 * la barre FLOTTANTE de macOS 26 — une surface de la primitive, d'UN seul ton
 * pour tout le rail, et une sélection en remplissage NEUTRE translucide
 * (Finder, Réglages Système) qui GLISSE d'une entrée à l'autre sur le ressort
 * de métamorphose. Jamais la marque en aplat : seule l'icône active prend
 * l'accent (`windowGlassSidebar.css`).
 *
 * Mode natif seulement (`useWindowGlass`) ; ailleurs, rien (`undefined`) et
 * le rail d'avant, au pixel près. `id` distingue les barres (réglages,
 * administration) : une sélection ne vole jamais d'une page à l'autre.
 */
export function useGlassSidebar(id: string): GlassSidebar {
  const glass = useWindowGlass();
  const reduced = useReducedMotion() ?? false;
  // Un GRAND verre : régime `surface` (ton mesuré à l'ouverture puis tenu,
  // matériau épais, jamais de bandes).
  const material = useLiquidGlassSurface({ radius: "lg", scale: "surface" });

  const selection = useMemo(() => {
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

  const { ref, className, style, ...attributes } = material.props;
  const surface = glass && material.render !== "fallback"
    ? { ref, className, style, attributes, layers: material.layers }
    : undefined;
  return { selection, surface };
}
