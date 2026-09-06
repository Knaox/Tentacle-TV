import { useConnectivity } from "./useConnectivity";

/**
 * Y a-t-il au moins un titre complet sur cet appareil pour ce compte ?
 *
 * Tant que le moteur hors ligne n'est pas branché, la réponse est « non » :
 * le voile plein écran garde alors exactement son comportement d'aujourd'hui,
 * hystérésis en plus. Le moteur remplacera ce corps par la liste locale.
 */
export function useHasLocalContent(): boolean {
  return false;
}

/**
 * L'application doit-elle montrer sa NAVIGATION LOCALE (catalogue de
 * l'appareil, onglets réduits) ?
 *
 * Oui en mode manuel — l'utilisateur l'a demandé —, et en hors ligne
 * automatique seulement s'il y a quelque chose à montrer ; sans contenu local,
 * il n'y a rien d'autre à faire que le voile.
 */
export function useOfflineMode(): boolean {
  const { state } = useConnectivity();
  const hasLocalContent = useHasLocalContent();
  return state === "offline-manual" || (state === "offline-auto" && hasLocalContent);
}
