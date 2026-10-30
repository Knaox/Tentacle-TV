/**
 * Octave — un titre qui ne se LIT pas (`MusicTrack.unavailable`, posé par l'extension : un titre importé qu'aucune
 * source ne lit, une sortie sans écoute publique — lot « fl », 30/10). Règle commune au web, au bureau et au mobile :
 * - il est GRISÉ partout où il paraît (rangée, file d'attente) ;
 * - la FILE le saute (`queueModel.ts` : fin du titre, « Suivant », « Précédent », aléatoire, départ d'une liste) ;
 * - un GESTE dessus (toucher, clic, Entrée, la file d'attente) ne lance rien et ne passe pas au suivant : le cœur dit
 *   seulement qu'il n'est pas disponible (`announceUnavailableTrack` → l'avis de chaque application) ;
 * - le hors ligne ne le tente jamais (`offline-core` › `canKeepTrack`).
 * Un titre de la bibliothèque se lit toujours. Il redevient lisible seul : l'extension cesse de le marquer.
 */

import type { MusicTrack } from "../music";

export function isTrackUnavailable(track: Pick<MusicTrack, "jellyfinId" | "unavailable">): boolean {
  return !track.jellyfinId && track.unavailable != null;
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Un geste a visé un titre indisponible : chaque application le dit dans son avis (une seule fois par geste). */
export function announceUnavailableTrack(): void {
  for (const listener of [...listeners]) listener();
}

/** L'avis d'une application s'y abonne (monté une fois dans sa coquille) ; rend le désabonnement. */
export function onUnavailableTrack(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
