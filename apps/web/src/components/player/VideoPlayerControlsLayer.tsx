/**
 * La COUCHE d'habillage du lecteur web — sa présence, et son fondu.
 *
 * Elle ne se pose pas sur l'écran de CHARGEMENT : tant que la première image
 * n'est pas rendue, il n'y a rien à commander, et une barre de progression à
 * zéro par-dessus une jaquette ne dit que du faux. Elle était jusqu'ici peinte
 * SOUS la bannière de chargement (`z-auto` contre son `z-10`) : invisible, mais
 * toujours cliquable — et l'inverse du bureau, où elle passait par-dessus. Une
 * seule règle désormais, et un `z-20` explicite : l'empilement est dit, plutôt
 * que subi.
 *
 * Le fondu porte sur l'opacité seule, jamais sur un démontage : la barre garde
 * son état (menus ouverts, position de survol) d'une apparition à l'autre.
 *
 * Extraite de `VideoPlayer.tsx` pour le ramener sous les 300 lignes. Elle ne
 * décide de rien d'autre — les commandes elles-mêmes vivent dans
 * `PlayerControls`, dont elle transmet les propriétés telles quelles.
 */

import type { ComponentProps, ReactElement } from "react";
import { PlayerControls } from "../PlayerControls";

interface VideoPlayerControlsLayerProps {
  /** La première image a été rendue : avant, il n'y a rien à commander. */
  hasStarted: boolean;
  /** L'habillage est-il à l'écran ? (auto-masquage après inactivité). */
  visible: boolean;
  controls: ComponentProps<typeof PlayerControls>;
}

export function VideoPlayerControlsLayer({
  hasStarted, visible, controls,
}: VideoPlayerControlsLayerProps): ReactElement | null {
  if (!hasStarted) return null;
  return (
    <div
      className={`absolute inset-0 z-20 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <PlayerControls {...controls} />
    </div>
  );
}
