/**
 * Octave — toucher la rangée d'un titre, la même règle sur le bureau et le mobile : le titre EN COURS de la même
 * liste se met en pause ou reprend (jamais un redémarrage) ; tout autre titre lance la liste depuis lui — sauf un
 * titre INDISPONIBLE (`unavailableTrack.ts`) : rien ne se lance, la lecture en cours continue, on le dit.
 */
export function rowClickAction(
  clickedKey: string | undefined,
  currentKey: string | null,
  playingContext: string | null,
  contextId: string,
  unavailable = false,
): "toggle" | "play" | "unavailable" {
  if (unavailable) return "unavailable";
  return clickedKey !== undefined && clickedKey === currentKey && playingContext === contextId ? "toggle" : "play";
}
