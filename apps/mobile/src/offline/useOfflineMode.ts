import { useUserId } from "@tentacle-tv/api-client";
import { isDeviceSideReason } from "@tentacle-tv/offline-core";
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
 * automatique s'il y a quelque chose à montrer OU si c'est la CONNEXION qui
 * manque (aucun réseau, délai dépassé) : l'accueil serveur n'a alors rien à
 * offrir, même sans titre — l'état vide l'explique. Sans titre et le serveur
 * en cause, il ne reste que le voile.
 */
export function useOfflineMode(): boolean {
  const { state, reason } = useConnectivity();
  const hasLocalContent = useHasLocalContent();
  if (state === "offline-manual") return true;
  if (state !== "offline-auto") return false;
  // Liste pas encore lue : le catalogue local (qui a sa propre attente),
  // jamais l'accueil serveur.
  return hasLocalContent !== false || isDeviceSideReason(reason);
}
