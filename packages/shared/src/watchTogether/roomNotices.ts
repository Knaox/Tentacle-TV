import type { WtRoomStateDto, WtStateCause } from "../types/watchTogether";
import type { WtToastEffect } from "./roomState";

/**
 * Watch Together — ce qu'un nouvel état dit des ARRIVÉES et des DÉPARTS de la
 * LECTURE (retour de Damien du 20/10 : un membre qui ferme son lecteur ne
 * disait rien aux autres ; un arrivant non plus). L'entrée et la sortie du
 * GROUPE restent dans `wtStateEffects` (« a rejoint / a quitté le groupe »).
 *
 * - « X rejoint la lecture » : la salle se met à l'attendre (`arrivingUserIds`,
 *   serveur du 20/10) — clic « Rejoindre » d'un membre déjà dans le groupe, ou
 *   son lecteur qui s'ouvre ; un NOUVEAU membre a déjà « a rejoint le groupe » ;
 * - « X n'a pas rejoint la lecture » : il arrivait et n'arrivera pas (retour
 *   arrière, appli tuée, délai) ;
 * - « X a quitté la lecture » : il regardait le titre et ne le regarde plus —
 *   lecteur fermé, appli tuée —, alors qu'il reste dans le groupe. Rien au
 *   changement de titre (tout le monde recharge), rien sur un échec (« ne peut
 *   pas lire » le dit déjà). Ce cas-là marche aussi face à un serveur d'avant.
 *
 * Jamais pour soi : un autre appareil du même compte n'est pas « quelqu'un ».
 */
export function playbackPresenceToasts(
  prev: WtRoomStateDto,
  next: WtRoomStateDto,
  cause: WtStateCause,
  selfId: string,
): WtToastEffect[] {
  if (prev.groupId !== next.groupId) return [];
  const toasts: WtToastEffect[] = [];
  const arrivingBefore = new Set(prev.arrivingUserIds ?? []);
  const arrivingNow = new Set(next.arrivingUserIds ?? []);
  const sameItem = prev.itemId !== null && prev.itemId === next.itemId;
  for (const member of next.members) {
    const before = prev.members.find((m) => m.userId === member.userId);
    if (member.userId === selfId || !before) continue;
    const name = { name: member.username };
    if (arrivingNow.has(member.userId) && !arrivingBefore.has(member.userId)) {
      toasts.push({ kind: "info", key: "memberArriving", params: name });
    } else if (arrivingBefore.has(member.userId) && !arrivingNow.has(member.userId)) {
      if (!member.inPlayback && !member.playbackError) {
        toasts.push({ kind: "info", key: "memberArrivalCancelled", params: name });
      }
    } else if (sameItem && cause !== "setItem" && before.inPlayback && !member.inPlayback && !member.playbackError) {
      toasts.push({ kind: "info", key: "memberLeftPlayback", params: name });
    }
  }
  return toasts;
}
