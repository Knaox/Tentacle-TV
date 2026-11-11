import { useReducedMotion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import type { SettingsShellSurface } from "@tentacle-tv/ui";

import { useWindowGlass } from "../../desktop/windowGlass";
import { SlidingMarker } from "../ui/SlidingMarker";

/**
 * Rayon de la sélection, en px : CONCENTRIQUE à la plaque — `--lg-radius-lg`
 * (22) moins son débord (`--lg-chrome-sidebar-pad`, 8).
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
 * la plaque de verre de la maquette, peinte AUTOUR du rail sans changer sa
 * boîte, et une sélection (le dégradé rose → violet de la maquette) qui GLISSE
 * d'une entrée à l'autre sur le compositeur (`SlidingMarker`, mesurée dans la fenêtre : jamais
 * une diagonale quand la page change de défilement — cf. `NavTab`).
 *
 * Mode natif seulement (`useWindowGlass`) ; ailleurs, rien (`undefined`) et
 * le rail d'avant, au pixel près. `id` distingue les barres (réglages,
 * administration) : une sélection ne vole jamais d'une page à l'autre.
 */
export function useGlassSidebar(id: string): GlassSidebar {
  const glass = useWindowGlass();
  const reduced = useReducedMotion() ?? false;

  const selection = useMemo(() => {
    if (!glass) return undefined;
    return (
      <SlidingMarker
        group={`sidebar-${id}`}
        still={reduced}
        className="lgc-sidebar-selection absolute inset-0"
        style={{ borderRadius: SELECTION_RADIUS }}
      />
    );
  }, [glass, reduced, id]);

  // Le verre change le MATÉRIAU, jamais les DIMENSIONS (Damien, 26/10) : le
  // rail garde sa boîte d'avant ; sa plaque de verre (le panneau de la
  // maquette) est peinte AUTOUR par `.lgc-sidebar-plate` (`windowGlassSidebar.css`).
  const surface = useMemo(() => (glass ? { className: "lgc-sidebar-plate" } : undefined), [glass]);
  return { selection, surface };
}
