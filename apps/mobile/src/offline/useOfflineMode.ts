import { useUserId } from "@tentacle-tv/api-client";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { useConnectivity } from "./useConnectivity";

/**
 * Y a-t-il au moins un titre complet sur cet appareil pour ce compte ?
 *
 * Lu dans la liste locale (SQLite), invalidée à chaque évènement du moteur.
 * Tant qu'elle n'a pas répondu, la réponse est « non » : le voile plein
 * écran garde son comportement d'aujourd'hui.
 */
export function useHasLocalContent(): boolean {
  const userId = useUserId();
  const { data } = useOfflineList(userId);
  return (data ?? []).some((entry) => entry.status === "complete");
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
