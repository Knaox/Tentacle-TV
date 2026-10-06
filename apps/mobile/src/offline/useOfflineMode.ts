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
 * automatique QUELLE QUE SOIT la cause, même sans titre : plus aucun voile
 * (retour de Damien, 2026-10-06) — le message temporaire dit le cas, l'état
 * vide du catalogue le redit.
 */
export function useOfflineMode(): boolean {
  const { state } = useConnectivity();
  return state === "offline-manual" || state === "offline-auto";
}
