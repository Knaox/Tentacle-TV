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

/**
 * Un geste qui vise UN titre d'une liste (tuile, ligne courte du « déjà écouté ») : il lance la liste depuis lui —
 * sauf un titre illisible (lot « ol »), dont l'avis seul part (`announce`). Jamais la liste lancée depuis le
 * suivant à sa place : le geste visait CE titre.
 */
export function playTrackGesture<T extends { key: string }>(
  tracks: readonly T[],
  index: number,
  unavailable: (track: T) => boolean,
  play: (tracks: readonly T[], index: number) => void,
  announce: (track: T) => void,
): void {
  const track = tracks[index];
  if (!track) return;
  if (unavailable(track)) announce(track);
  else play(tracks, index);
}
