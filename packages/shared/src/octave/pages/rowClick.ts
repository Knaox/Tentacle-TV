/**
 * Octave — toucher la rangée d'un titre, la même règle sur le bureau et le mobile : le titre EN COURS de la même
 * liste se met en pause ou reprend (jamais un redémarrage) ; tout autre titre lance la liste depuis lui.
 */
export function rowClickAction(clickedKey: string | undefined, currentKey: string | null, playingContext: string | null, contextId: string): "toggle" | "play" {
  return clickedKey !== undefined && clickedKey === currentKey && playingContext === contextId ? "toggle" : "play";
}
