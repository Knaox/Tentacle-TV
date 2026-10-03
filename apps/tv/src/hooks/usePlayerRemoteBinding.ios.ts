import { useIsFocused } from "@react-navigation/native";
import { applyPlayerRemoteSteps, playerRemoteSteps, TVOS_BINDINGS, type PlayerRemoteHandlers } from "@tentacle-tv/tv-core";
import { useRemoteIntents } from "../platform/tvos/input";

/**
 * La télécommande du lecteur sur APPLE TV (la variante Android TV :
 * `usePlayerRemoteBinding.ts`). Les intentions de l'entrée unique
 * (`platform/tvos/input`) passent par la table du lecteur (tv-core
 * `playerRemoteSteps`) jusqu'à ses contrôles (`playerControls.ts`) ; le
 * lecteur ne PREND rien — il voit passer, comme avant, tant que son écran est
 * devant. Retour n'y entre pas : la pile du Retour le sert
 * (`usePlayerBackLayers`).
 */
export function usePlayerRemoteBinding(remote: PlayerRemoteHandlers): void {
  const focused = useIsFocused();
  useRemoteIntents((event) => applyPlayerRemoteSteps(playerRemoteSteps(event.intent, TVOS_BINDINGS.traits), remote), focused);
}
