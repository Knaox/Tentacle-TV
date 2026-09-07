import { useUserId } from "@tentacle-tv/api-client";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { useConnectivity } from "./useConnectivity";

/**
 * Y a-t-il au moins un titre complet sur cet appareil pour ce compte ?
 *
 * Lu dans la liste locale (SQLite), invalidée à chaque évènement du moteur.
 * Tant qu'elle n'a pas répondu : `null` — ni oui ni non. Dire « non » trop
 * tôt montrait le voile « aucun contenu » une seconde à qui a des titres.
 */
export function useHasLocalContent(): boolean | null {
  const userId = useUserId();
  const { data } = useOfflineList(userId);
  if (data === undefined) return null;
  return data.some((entry) => entry.status === "complete");
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
  // Liste pas encore lue : le catalogue local (qui a sa propre attente),
  // jamais l'accueil serveur.
  return state === "offline-manual" || (state === "offline-auto" && hasLocalContent !== false);
}
