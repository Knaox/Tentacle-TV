import type { RemoteIntent } from "../remote/intents";

/**
 * Le panneau du message-outil du lecteur (un serveur ne répond plus) et le
 * focus : il PARAÎT sans le prendre ; c'est le premier APPUI de l'utilisateur
 * qui l'active (focus sur « Réessayer maintenant ») — pas un pouce posé sur
 * le pavé, ni Retour, ni un glisser.
 */
export function activatesTroublePanel(intent: RemoteIntent): boolean {
  switch (intent.type) {
    case "select":
    case "playPause":
    case "move":
      return true;
    case "hold":
      return intent.key === "select";
    default:
      return false;
  }
}

/** Un bouton qui paraît ou part (« Baisser la qualité ») réordonne les vues
 *  natives, et UIKit perd le focus de celle qu'il déplace : passé ce délai,
 *  le panneau activé reprend « Réessayer maintenant » si le focus l'a quitté. */
export const TROUBLE_REFOCUS_MS = 120;

/** Le focus est-il (encore) dans le message-outil ? */
export function focusInTrouble(focusedKey: string | null | undefined): boolean {
  return !!focusedKey?.startsWith("trouble:");
}

/** Le panneau part (la lecture reprend) : il rend le focus qu'il tenait — à
 *  l'habillage s'il est là ; sinon le fond le réclame de lui-même. */
export function troubleLeaveReturnsToOsd(focusedKey: string | null | undefined, osdVisible: boolean): boolean {
  return focusInTrouble(focusedKey) && osdVisible;
}
