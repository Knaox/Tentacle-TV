import { TV_STAGE } from "@tentacle-tv/theme";
import { RENDER } from "../../redesign/render/renderProfile";

/** L'agrandissement d'une carte focalisée (fiche : épisodes, distribution, extras). */
export const FOCUS_ZOOM = TV_STAGE.focus.cardScale;

/**
 * Les PIXELS à demander au serveur pour une image affichée sur `points`, que
 * le focus agrandit jusqu'à `zoom` : l'échelle de l'interface (`imageScale` du
 * profil de rendu), ou l'agrandissement s'il la dépasse.
 *
 * Apple TV 4K (échelle 2) : le double des points, comme toujours — le focus
 * tient dans la marge. Android TV (1080p, un pixel par point) : la taille
 * affichée, agrandissement compris — le quart des pixels d'avant, autant de
 * moins à décoder et à envoyer au GPU, pour la même image à l'écran.
 */
export function imagePixels(points: number, zoom = 1): number {
  return Math.ceil(points * Math.max(RENDER.imageScale, zoom));
}
