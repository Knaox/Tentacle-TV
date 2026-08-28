/**
 * La sortie du lecteur décide de l'état de FENÊTRE à rendre — Linux.
 *
 * Le constat (28.08) : sur Linux, le plein écran posé PENDANT une lecture
 * (bouton du lecteur, touche F) survivait à la sortie du film — on parcourait
 * ensuite tout le catalogue en plein écran, sans l'avoir demandé. Windows a sa
 * parade (`sessionLecteurPleinEcran`), macOS a sa règle (ne rien défaire, le
 * plein écran système a son espace) ; Linux, lui, héritait du « ne rien
 * défaire » macOS sans ses raisons.
 *
 * La règle choisie par l'utilisateur (28.08) : à la sortie d'une lecture en
 * plein écran, la fenêtre devient MAXIMISÉE — elle remplit l'écran mais reste
 * une fenêtre. Sauf si le plein écran existait AVANT la lecture (F11 posé par
 * l'utilisateur) : celui-là lui appartient, on le laisse.
 *
 * # Ce que la décision refuse, et pourquoi
 *
 * - Le montage Wayland IMPOSÉ (GNOME/wlroots, `fenetrage !== "libre"`) :
 *   `SurfaceWayland` y possède sa propre restauration (mémoire `avant`) et
 *   ÉPINGLE le plein écran tant que la vidéo est attachée (`leave-full-screen`
 *   → réaffirmation). Décider ici entrerait en guerre avec l'épingle.
 * - macOS et Windows : leurs chemins actuels, éprouvés, restent intacts.
 */

export type PlayerExitAction = "rien" | "quitterPleinEcranPuisMaximiser";

export interface PlayerExitInput {
  platform: NodeJS.Platform;
  montage: "wayland" | "x11" | null;
  fenetrage: "libre" | "plein-ecran" | null;
  /** La fenêtre était-elle DÉJÀ en plein écran avant la lecture ? `null` = aucune session ouverte. */
  dejaEnPleinEcran: boolean | null;
  /** État courant de la fenêtre au moment de la sortie. */
  enPleinEcran: boolean;
}

export function decidePlayerExitAction(input: PlayerExitInput): PlayerExitAction {
  if (input.platform !== "linux") return "rien";
  // Sans montage décidé, on ne sait rien du terrain : ne rien toucher.
  if (input.montage === null) return "rien";
  if (input.montage === "wayland" && input.fenetrage !== "libre") return "rien";
  // Pas de session lecteur : rien n'a été ouvert, rien à défaire.
  if (input.dejaEnPleinEcran === null) return "rien";
  // Le plein écran précédait le film : il est à l'utilisateur.
  if (input.dejaEnPleinEcran) return "rien";
  if (!input.enPleinEcran) return "rien";
  return "quitterPleinEcranPuisMaximiser";
}
