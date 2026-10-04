import { useIsFocused } from "@react-navigation/native";
import { applyPlayerRemoteSteps, playerRemoteSteps, type PlayerRemoteHandlers } from "@tentacle-tv/tv-core";
import { REMOTE_BINDINGS, useRemoteIntents } from "../platform/input";

/**
 * La télécommande du lecteur par l'ENTRÉE UNIQUE de la plateforme
 * (`platform/input` : Apple TV, et Android TV refondu). Les intentions
 * passent par la table du lecteur (tv-core `playerRemoteSteps`, lue avec les
 * traits de la télécommande) jusqu'à ses contrôles (`playerControls.ts`) ; le
 * lecteur ne PREND rien — il voit passer, tant que son écran est devant.
 * Retour n'y entre pas : la pile du Retour le sert (`usePlayerBackLayers`).
 */
export function usePlayerIntentBinding(remote: PlayerRemoteHandlers): void {
  const focused = useIsFocused();
  useRemoteIntents(
    (event) => applyPlayerRemoteSteps(playerRemoteSteps(event.intent, REMOTE_BINDINGS.traits), remote),
    focused,
  );
}
