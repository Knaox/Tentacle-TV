/**
 * Octave — les titres LANCÉS depuis une recherche (« Titres récemment recherchés ») : suit le lecteur et signale le
 * titre choisi quand une file née d'une recherche (`search:<requête>`, `queryOfContext`) part de lui. Seul le geste
 * compte : l'enchaînement au suivant, « Suivant », l'aléatoire, un ajout à la file ne changent pas la file
 * lancée (mêmes entrées) et ne signalent rien ; relancer le titre déjà en cours non plus. Web, bureau et mobile.
 */

import type { MusicTrack } from "../../music";
import type { OctavePlayer } from "../octavePlayer";
import { currentItem } from "../queueModel";
import { queryOfContext } from "./searchListens";

export interface SearchPick {
  track: MusicTrack;
  query: string;
}

/** Rend sa désinscription. */
export function watchSearchPicks(player: OctavePlayer, onPick: (pick: SearchPick) => void): () => void {
  let items = player.snapshot.get().queue.items;
  let currentKey = player.snapshot.get().current?.key ?? null;
  return player.snapshot.subscribe(() => {
    const snap = player.snapshot.get();
    const { queue } = snap;
    const key = snap.current?.key ?? null;
    const relaunched = queue.items !== items && key !== currentKey;
    items = queue.items;
    currentKey = key;
    if (!relaunched) return;
    const query = queryOfContext(queue.contextId);
    const item = currentItem(queue);
    if (query !== null && item) onPick({ track: item.track, query });
  });
}
